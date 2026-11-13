"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import type { AuthTokenPayload } from "@/lib/auth/jwt";
import { getUserById } from "@/lib/auth/user-service";
import { recordAuditLog } from "@/lib/admin/audit";
import { errorMessage, invalidateDatabaseCheck, isDatabaseReady, withTimeout } from "@/lib/admin/db";
import { getMemoryStore, memoryId, type MemOptionGroup } from "@/lib/admin/memory-store";
import {
  ADJUSTMENT_REASONS,
  type ActionResult,
  type AdjustmentReason,
} from "@/lib/admin/types";

const ACTION_TIMEOUT_MS = 6000;

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Di luar konteks request Next.js
  }
}

function revalidateCatalogAndAdmin() {
  safeRevalidate("/");
  safeRevalidate("/menu");
  safeRevalidate("/checkout");
  safeRevalidate("/admin");
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 110) || `kategori-${Date.now().toString(36)}`
  );
}

/** Validasi ketat RBAC Admin (JWT + status aktif akun) di setiap Server Action. */
async function requireAdmin(): Promise<AuthTokenPayload> {
  const session = await requireRole(["ADMIN"]);
  const user = await getUserById(session.sub);
  if (user && !user.isActive) {
    throw new Error("Akun Administrator Anda sedang dinonaktifkan.");
  }
  return session;
}

/** Memastikan FK actor_id hanya diisi bila row User ada di MySQL. */
async function resolveDbActorId(
  tx: Pick<typeof prisma, "user">,
  actorId: string,
): Promise<string | null> {
  const found = await tx.user.findUnique({ where: { id: actorId }, select: { id: true } });
  return found?.id ?? null;
}

function syncProductAvailability(deletedAt: Date | null, availableQty: number): boolean {
  return !deletedAt && availableQty > 0;
}

/* ----------------------------------------------------------------------------
 * 1. CRUD Kategori + Soft Delete + Restore
 * ------------------------------------------------------------------------- */

const CategorySchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2, "Nama kategori minimal 2 karakter.").max(100),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0, "Urutan minimal 0.").default(0),
  isActive: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof CategorySchema>;

export async function upsertCategoryAction(input: CategoryInput): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CategorySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Input kategori tidak valid." };
    }

    const data = parsed.data;
    const finalSlug = slugify(data.slug && data.slug.length > 0 ? data.slug : data.name);
    const desc = data.description?.trim() ? data.description.trim() : null;

    if (await isDatabaseReady()) {
      try {
        if (data.id) {
          const prev = await withTimeout(prisma.category.findUnique({ where: { id: data.id } }), ACTION_TIMEOUT_MS);
          if (!prev) return { success: false, error: "Kategori tidak ditemukan." };

          const updated = await withTimeout(
            prisma.category.update({
              where: { id: data.id },
              data: {
                name: data.name,
                slug: finalSlug,
                description: desc,
                sort_order: data.sortOrder,
                is_active: data.isActive,
              },
            }),
            ACTION_TIMEOUT_MS,
          );

          await recordAuditLog({
            actorId: admin.sub,
            actorName: admin.name,
            actorRole: admin.role,
            entityName: "categories",
            entityId: updated.id,
            action: "UPDATE_CATEGORY",
            oldData: { name: prev.name, slug: prev.slug, is_active: prev.is_active, sort_order: prev.sort_order },
            newData: { name: updated.name, slug: updated.slug, is_active: updated.is_active, sort_order: updated.sort_order },
          });

          revalidateCatalogAndAdmin();
          return { success: true, message: `Kategori "${updated.name}" berhasil diperbarui.` };
        }

        const created = await withTimeout(
          prisma.category.create({
            data: {
              id: memoryId("cat"),
              name: data.name,
              slug: finalSlug,
              description: desc,
              sort_order: data.sortOrder,
              is_active: data.isActive,
            },
          }),
          ACTION_TIMEOUT_MS,
        );

        await recordAuditLog({
          actorId: admin.sub,
          actorName: admin.name,
          actorRole: admin.role,
          entityName: "categories",
          entityId: created.id,
          action: "CREATE_CATEGORY",
          oldData: null,
          newData: { name: created.name, slug: created.slug, is_active: created.is_active },
        });

        revalidateCatalogAndAdmin();
        return { success: true, message: `Kategori "${created.name}" berhasil ditambahkan.` };
      } catch (err) {
        const msg = errorMessage(err);
        if (msg.includes("Unique constraint") || msg.includes("Duplicate entry")) {
          return { success: false, error: `Slug kategori "${finalSlug}" sudah digunakan.` };
        }
        invalidateDatabaseCheck();
        return { success: false, error: msg };
      }
    }

    // Memory mode
    const store = getMemoryStore();
    const duplicate = [...store.categories.values()].find(
      (c) => c.slug === finalSlug && c.id !== data.id,
    );
    if (duplicate) {
      return { success: false, error: `Slug kategori "${finalSlug}" sudah digunakan.` };
    }

    if (data.id) {
      const prev = store.categories.get(data.id);
      if (!prev) return { success: false, error: "Kategori tidak ditemukan." };
      const oldSnapshot = { name: prev.name, slug: prev.slug, is_active: prev.is_active, sort_order: prev.sort_order };
      prev.name = data.name;
      prev.slug = finalSlug;
      prev.description = desc;
      prev.sort_order = data.sortOrder;
      prev.is_active = data.isActive;
      store.categories.set(prev.id, prev);

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "categories",
        entityId: prev.id,
        action: "UPDATE_CATEGORY",
        oldData: oldSnapshot,
        newData: { name: prev.name, slug: prev.slug, is_active: prev.is_active, sort_order: prev.sort_order },
      });

      revalidateCatalogAndAdmin();
      return { success: true, message: `Kategori "${prev.name}" berhasil diperbarui.` };
    }

    const newCat = {
      id: memoryId("cat"),
      name: data.name,
      slug: finalSlug,
      description: desc,
      sort_order: data.sortOrder,
      is_active: data.isActive,
      deleted_at: null,
      created_at: new Date(),
    };
    store.categories.set(newCat.id, newCat);

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "categories",
      entityId: newCat.id,
      action: "CREATE_CATEGORY",
      oldData: null,
      newData: { name: newCat.name, slug: newCat.slug, is_active: newCat.is_active },
    });

    revalidateCatalogAndAdmin();
    return { success: true, message: `Kategori "${newCat.name}" berhasil ditambahkan.` };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal menyimpan kategori.") };
  }
}

export async function softDeleteCategoryAction(categoryId: string, reason?: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const cleanReason = reason?.trim() || "Diarsipkan oleh Admin (Soft Delete)";

    if (await isDatabaseReady()) {
      const prev = await withTimeout(prisma.category.findUnique({ where: { id: categoryId } }), ACTION_TIMEOUT_MS);
      if (!prev) return { success: false, error: "Kategori tidak ditemukan." };
      if (prev.deleted_at) return { success: false, error: "Kategori sudah diarsipkan." };

      const now = new Date();
      await withTimeout(
        prisma.category.update({
          where: { id: categoryId },
          data: { deleted_at: now, is_active: false },
        }),
        ACTION_TIMEOUT_MS,
      );

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "categories",
        entityId: categoryId,
        action: "SOFT_DELETE_CATEGORY",
        oldData: { name: prev.name, is_active: prev.is_active, deleted_at: null },
        newData: { name: prev.name, is_active: false, deleted_at: now.toISOString() },
        reason: cleanReason,
      });

      revalidateCatalogAndAdmin();
      return { success: true, message: `Kategori "${prev.name}" berhasil diarsipkan (Soft Delete).` };
    }

    const store = getMemoryStore();
    const prev = store.categories.get(categoryId);
    if (!prev) return { success: false, error: "Kategori tidak ditemukan." };
    const now = new Date();
    prev.deleted_at = now;
    prev.is_active = false;
    store.categories.set(categoryId, prev);

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "categories",
      entityId: categoryId,
      action: "SOFT_DELETE_CATEGORY",
      oldData: { name: prev.name, is_active: true, deleted_at: null },
      newData: { name: prev.name, is_active: false, deleted_at: now.toISOString() },
      reason: cleanReason,
    });

    revalidateCatalogAndAdmin();
    return { success: true, message: `Kategori "${prev.name}" berhasil diarsipkan (Soft Delete).` };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal mengarsipkan kategori.") };
  }
}

export async function restoreCategoryAction(categoryId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    if (await isDatabaseReady()) {
      const prev = await withTimeout(prisma.category.findUnique({ where: { id: categoryId } }), ACTION_TIMEOUT_MS);
      if (!prev) return { success: false, error: "Kategori tidak ditemukan." };

      await withTimeout(
        prisma.category.update({
          where: { id: categoryId },
          data: { deleted_at: null, is_active: true },
        }),
        ACTION_TIMEOUT_MS,
      );

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "categories",
        entityId: categoryId,
        action: "RESTORE_CATEGORY",
        oldData: { name: prev.name, deleted_at: prev.deleted_at },
        newData: { name: prev.name, is_active: true, deleted_at: null },
        reason: "Dipulihkan dari arsip oleh Admin",
      });

      revalidateCatalogAndAdmin();
      return { success: true, message: `Kategori "${prev.name}" berhasil dipulihkan.` };
    }

    const store = getMemoryStore();
    const prev = store.categories.get(categoryId);
    if (!prev) return { success: false, error: "Kategori tidak ditemukan." };
    const oldDeletedAt = prev.deleted_at;
    prev.deleted_at = null;
    prev.is_active = true;
    store.categories.set(categoryId, prev);

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "categories",
      entityId: categoryId,
      action: "RESTORE_CATEGORY",
      oldData: { name: prev.name, deleted_at: oldDeletedAt },
      newData: { name: prev.name, is_active: true, deleted_at: null },
      reason: "Dipulihkan dari arsip oleh Admin",
    });

    revalidateCatalogAndAdmin();
    return { success: true, message: `Kategori "${prev.name}" berhasil dipulihkan.` };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal memulihkan kategori.") };
  }
}

/* ----------------------------------------------------------------------------
 * 2. CRUD Menu & Varian + Soft Delete + Restore
 * ------------------------------------------------------------------------- */

const OptionItemSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Nama pilihan varian wajib diisi.").max(100),
  priceAdjustment: z.coerce.number().min(0, "Harga tambahan tidak boleh negatif.").default(0),
  isAvailable: z.boolean().default(true),
});

const OptionGroupSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Nama grup varian wajib diisi.").max(100),
  isRequired: z.boolean().default(false),
  isMulti: z.boolean().default(false),
  items: z.array(OptionItemSchema).min(1, "Setiap grup varian minimal harus memiliki 1 pilihan."),
});

const ProductSchema = z.object({
  id: z.string().trim().optional(),
  categoryId: z.string().trim().min(1, "Kategori wajib dipilih."),
  name: z.string().trim().min(2, "Nama menu minimal 2 karakter.").max(120),
  description: z.string().trim().max(1000).optional(),
  basePrice: z.coerce.number().min(0, "Harga dasar tidak boleh negatif."),
  imageUrl: z.string().trim().max(255).optional(),
  isAvailable: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  initialQty: z.coerce.number().int().min(0, "Stok awal minimal 0.").default(20),
  minThreshold: z.coerce.number().int().min(0, "Batas peringatan minimal 0.").default(5),
  optionGroups: z.array(OptionGroupSchema).default([]),
});

export type ProductInput = z.infer<typeof ProductSchema>;

export async function saveProductAction(input: ProductInput): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = ProductSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Data menu tidak valid." };
    }

    const d = parsed.data;
    const cleanDesc = d.description?.trim() ? d.description.trim() : null;
    const cleanImage = d.imageUrl?.trim() ? d.imageUrl.trim() : null;

    if (await isDatabaseReady()) {
      try {
        if (d.id) {
          const existing = await withTimeout(
            prisma.product.findUnique({
              where: { id: d.id },
              include: {
                stock: true,
                option_groups: {
                  include: {
                    option_items: {
                      include: { _count: { select: { order_item_options: true } } },
                    },
                  },
                },
              },
            }),
            ACTION_TIMEOUT_MS,
          );
          if (!existing) return { success: false, error: "Produk tidak ditemukan." };

          await withTimeout(
            prisma.$transaction(async (tx) => {
              const currentAvailable = existing.stock?.available_qty ?? 0;
              const effectiveAvailable = existing.deleted_at ? false : d.isAvailable && currentAvailable > 0;

              await tx.product.update({
                where: { id: d.id },
                data: {
                  category_id: d.categoryId,
                  name: d.name,
                  description: cleanDesc,
                  base_price: d.basePrice,
                  image_url: cleanImage,
                  is_available: effectiveAvailable,
                  sort_order: d.sortOrder,
                },
              });

              if (existing.stock) {
                await tx.productStock.update({
                  where: { product_id: existing.id },
                  data: { min_threshold: d.minThreshold },
                });
              }

              // Reconcile Option Groups & Items agar tidak memutus FK histori order_item_options
              const existingGroupsMap = new Map(existing.option_groups.map((g) => [g.id, g]));
              const incomingGroupIds = new Set(d.optionGroups.map((g) => g.id).filter(Boolean));

              for (const oldGroup of existing.option_groups) {
                if (!incomingGroupIds.has(oldGroup.id)) {
                  const hasOrderHistory = oldGroup.option_items.some(
                    (it) => it._count.order_item_options > 0,
                  );
                  if (hasOrderHistory) {
                    await tx.productOptionItem.updateMany({
                      where: { option_group_id: oldGroup.id },
                      data: { is_available: false },
                    });
                  } else {
                    await tx.productOptionGroup.delete({ where: { id: oldGroup.id } });
                  }
                }
              }

              for (let gIdx = 0; gIdx < d.optionGroups.length; gIdx++) {
                const g = d.optionGroups[gIdx];
                const minSel = g.isRequired ? 1 : 0;
                const maxSel = g.isMulti ? Math.max(1, g.items.length) : 1;

                if (g.id && existingGroupsMap.has(g.id)) {
                  const oldGroup = existingGroupsMap.get(g.id)!;
                  await tx.productOptionGroup.update({
                    where: { id: oldGroup.id },
                    data: {
                      name: g.name,
                      is_required: g.isRequired,
                      min_select: minSel,
                      max_select: maxSel,
                      sort_order: gIdx + 1,
                    },
                  });

                  const oldItemsMap = new Map(oldGroup.option_items.map((it) => [it.id, it]));
                  const incomingItemIds = new Set(g.items.map((it) => it.id).filter(Boolean));

                  for (const oldIt of oldGroup.option_items) {
                    if (!incomingItemIds.has(oldIt.id)) {
                      if (oldIt._count.order_item_options > 0) {
                        await tx.productOptionItem.update({
                          where: { id: oldIt.id },
                          data: { is_available: false },
                        });
                      } else {
                        await tx.productOptionItem.delete({ where: { id: oldIt.id } });
                      }
                    }
                  }

                  for (let iIdx = 0; iIdx < g.items.length; iIdx++) {
                    const it = g.items[iIdx];
                    if (it.id && oldItemsMap.has(it.id)) {
                      await tx.productOptionItem.update({
                        where: { id: it.id },
                        data: {
                          name: it.name,
                          price_adjustment: it.priceAdjustment,
                          is_available: it.isAvailable,
                          sort_order: iIdx + 1,
                        },
                      });
                    } else {
                      await tx.productOptionItem.create({
                        data: {
                          id: memoryId("oi"),
                          option_group_id: oldGroup.id,
                          name: it.name,
                          price_adjustment: it.priceAdjustment,
                          is_available: it.isAvailable,
                          sort_order: iIdx + 1,
                        },
                      });
                    }
                  }
                } else {
                  await tx.productOptionGroup.create({
                    data: {
                      id: memoryId("og"),
                      product_id: existing.id,
                      name: g.name,
                      is_required: g.isRequired,
                      min_select: minSel,
                      max_select: maxSel,
                      sort_order: gIdx + 1,
                      option_items: {
                        create: g.items.map((it, iIdx) => ({
                          id: memoryId("oi"),
                          name: it.name,
                          price_adjustment: it.priceAdjustment,
                          is_available: it.isAvailable,
                          sort_order: iIdx + 1,
                        })),
                      },
                    },
                  });
                }
              }
            }),
            ACTION_TIMEOUT_MS,
          );

          const priceChanged = Number(existing.base_price) !== d.basePrice;
          await recordAuditLog({
            actorId: admin.sub,
            actorName: admin.name,
            actorRole: admin.role,
            entityName: "products",
            entityId: existing.id,
            action: priceChanged ? "UPDATE_PRODUCT_PRICE" : "UPDATE_PRODUCT",
            oldData: {
              name: existing.name,
              category_id: existing.category_id,
              base_price: Number(existing.base_price),
              is_available: existing.is_available,
            },
            newData: {
              name: d.name,
              category_id: d.categoryId,
              base_price: d.basePrice,
              is_available: d.isAvailable,
              option_groups_count: d.optionGroups.length,
            },
          });

          revalidateCatalogAndAdmin();
          return { success: true, message: `Menu "${d.name}" berhasil diperbarui.` };
        }

        // Create Produk Baru + Stok Awal + Varian
        const newProductId = memoryId("prd");
        await withTimeout(
          prisma.$transaction(async (tx) => {
            const dbActorId = await resolveDbActorId(tx, admin.sub);
            await tx.product.create({
              data: {
                id: newProductId,
                category_id: d.categoryId,
                name: d.name,
                description: cleanDesc,
                base_price: d.basePrice,
                image_url: cleanImage,
                is_available: d.isAvailable && d.initialQty > 0,
                sort_order: d.sortOrder,
                stock: {
                  create: {
                    id: memoryId("stk"),
                    available_qty: d.initialQty,
                    reserved_qty: 0,
                    min_threshold: d.minThreshold,
                  },
                },
                option_groups: {
                  create: d.optionGroups.map((g, gIdx) => ({
                    id: memoryId("og"),
                    name: g.name,
                    is_required: g.isRequired,
                    min_select: g.isRequired ? 1 : 0,
                    max_select: g.isMulti ? Math.max(1, g.items.length) : 1,
                    sort_order: gIdx + 1,
                    option_items: {
                      create: g.items.map((it, iIdx) => ({
                        id: memoryId("oi"),
                        name: it.name,
                        price_adjustment: it.priceAdjustment,
                        is_available: it.isAvailable,
                        sort_order: iIdx + 1,
                      })),
                    },
                  })),
                },
              },
            });

            if (d.initialQty > 0) {
              await tx.stockMovement.create({
                data: {
                  id: memoryId("mov"),
                  product_id: newProductId,
                  actor_id: dbActorId,
                  movement_type: "INITIAL_STOCK",
                  qty_change: d.initialQty,
                  available_before: 0,
                  available_after: d.initialQty,
                  reserved_before: 0,
                  reserved_after: 0,
                  reason: "Stok awal pembuatan menu baru",
                },
              });
            }
          }),
          ACTION_TIMEOUT_MS,
        );

        await recordAuditLog({
          actorId: admin.sub,
          actorName: admin.name,
          actorRole: admin.role,
          entityName: "products",
          entityId: newProductId,
          action: "CREATE_PRODUCT",
          oldData: null,
          newData: {
            name: d.name,
            category_id: d.categoryId,
            base_price: d.basePrice,
            initial_qty: d.initialQty,
            option_groups_count: d.optionGroups.length,
          },
        });

        revalidateCatalogAndAdmin();
        return { success: true, message: `Menu baru "${d.name}" berhasil ditambahkan.` };
      } catch (err) {
        invalidateDatabaseCheck();
        return { success: false, error: errorMessage(err, "Gagal menyimpan produk di database.") };
      }
    }

    // Memory mode
    const store = getMemoryStore();
    if (!store.categories.has(d.categoryId)) {
      return { success: false, error: "Kategori yang dipilih tidak ditemukan." };
    }

    const mappedGroups: MemOptionGroup[] = d.optionGroups.map((g) => ({
      id: g.id || memoryId("og"),
      name: g.name,
      is_required: g.isRequired,
      max_select: g.isMulti ? Math.max(1, g.items.length) : 1,
      items: g.items.map((it) => ({
        id: it.id || memoryId("oi"),
        name: it.name,
        price_adjustment: it.priceAdjustment,
        is_available: it.isAvailable,
      })),
    }));

    if (d.id) {
      const existing = store.products.get(d.id);
      if (!existing) return { success: false, error: "Produk tidak ditemukan." };
      const stock = store.stocks.get(d.id);
      const oldSnapshot = {
        name: existing.name,
        category_id: existing.category_id,
        base_price: existing.base_price,
        is_available: existing.is_available,
      };
      const priceChanged = existing.base_price !== d.basePrice;

      existing.category_id = d.categoryId;
      existing.name = d.name;
      existing.description = cleanDesc;
      existing.base_price = d.basePrice;
      existing.image_url = cleanImage;
      existing.sort_order = d.sortOrder;
      existing.is_available = existing.deleted_at
        ? false
        : d.isAvailable && (stock?.available_qty ?? 0) > 0;
      existing.option_groups = mappedGroups;
      store.products.set(existing.id, existing);

      if (stock) {
        stock.min_threshold = d.minThreshold;
        stock.updated_at = new Date();
      }

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "products",
        entityId: existing.id,
        action: priceChanged ? "UPDATE_PRODUCT_PRICE" : "UPDATE_PRODUCT",
        oldData: oldSnapshot,
        newData: {
          name: existing.name,
          category_id: existing.category_id,
          base_price: existing.base_price,
          is_available: existing.is_available,
          option_groups_count: mappedGroups.length,
        },
      });

      revalidateCatalogAndAdmin();
      return { success: true, message: `Menu "${existing.name}" berhasil diperbarui.` };
    }

    const newId = memoryId("prd");
    const now = new Date();
    store.products.set(newId, {
      id: newId,
      category_id: d.categoryId,
      name: d.name,
      description: cleanDesc,
      base_price: d.basePrice,
      image_url: cleanImage,
      is_available: d.isAvailable && d.initialQty > 0,
      sort_order: d.sortOrder,
      deleted_at: null,
      created_at: now,
      option_groups: mappedGroups,
    });
    store.stocks.set(newId, {
      product_id: newId,
      available_qty: d.initialQty,
      reserved_qty: 0,
      min_threshold: d.minThreshold,
      updated_at: now,
    });
    if (d.initialQty > 0) {
      store.movements.unshift({
        id: memoryId("mov"),
        product_id: newId,
        actor_id: admin.sub,
        actor_name: admin.name,
        movement_type: "INITIAL_STOCK",
        qty_change: d.initialQty,
        available_before: 0,
        available_after: d.initialQty,
        reserved_before: 0,
        reserved_after: 0,
        reason: "Stok awal pembuatan menu baru",
        created_at: now,
      });
    }

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "products",
      entityId: newId,
      action: "CREATE_PRODUCT",
      oldData: null,
      newData: {
        name: d.name,
        category_id: d.categoryId,
        base_price: d.basePrice,
        initial_qty: d.initialQty,
        option_groups_count: mappedGroups.length,
      },
    });

    revalidateCatalogAndAdmin();
    return { success: true, message: `Menu baru "${d.name}" berhasil ditambahkan.` };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal menyimpan produk.") };
  }
}

export async function softDeleteProductAction(productId: string, reason?: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const cleanReason = reason?.trim() || "Soft delete menu agar histori laporan penjualan tetap terjaga";

    if (await isDatabaseReady()) {
      const prev = await withTimeout(prisma.product.findUnique({ where: { id: productId } }), ACTION_TIMEOUT_MS);
      if (!prev) return { success: false, error: "Produk tidak ditemukan." };
      if (prev.deleted_at) return { success: false, error: "Menu ini sudah diarsipkan." };

      const now = new Date();
      await withTimeout(
        prisma.product.update({
          where: { id: productId },
          data: { deleted_at: now, is_available: false },
        }),
        ACTION_TIMEOUT_MS,
      );

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "products",
        entityId: productId,
        action: "SOFT_DELETE_PRODUCT",
        oldData: { name: prev.name, is_available: prev.is_available, deleted_at: null },
        newData: { name: prev.name, is_available: false, deleted_at: now.toISOString() },
        reason: cleanReason,
      });

      revalidateCatalogAndAdmin();
      return { success: true, message: `Menu "${prev.name}" diarsipkan (Soft Delete). Riwayat penjualan tetap aman.` };
    }

    const store = getMemoryStore();
    const prev = store.products.get(productId);
    if (!prev) return { success: false, error: "Produk tidak ditemukan." };
    const now = new Date();
    const oldAvail = prev.is_available;
    prev.deleted_at = now;
    prev.is_available = false;
    store.products.set(productId, prev);

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "products",
      entityId: productId,
      action: "SOFT_DELETE_PRODUCT",
      oldData: { name: prev.name, is_available: oldAvail, deleted_at: null },
      newData: { name: prev.name, is_available: false, deleted_at: now.toISOString() },
      reason: cleanReason,
    });

    revalidateCatalogAndAdmin();
    return { success: true, message: `Menu "${prev.name}" diarsipkan (Soft Delete). Riwayat penjualan tetap aman.` };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal mengarsipkan menu.") };
  }
}

export async function restoreProductAction(productId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    if (await isDatabaseReady()) {
      const prev = await withTimeout(
        prisma.product.findUnique({ where: { id: productId }, include: { stock: true } }),
        ACTION_TIMEOUT_MS,
      );
      if (!prev) return { success: false, error: "Produk tidak ditemukan." };

      const avail = (prev.stock?.available_qty ?? 0) > 0;
      await withTimeout(
        prisma.product.update({
          where: { id: productId },
          data: { deleted_at: null, is_available: avail },
        }),
        ACTION_TIMEOUT_MS,
      );

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "products",
        entityId: productId,
        action: "RESTORE_PRODUCT",
        oldData: { name: prev.name, deleted_at: prev.deleted_at },
        newData: { name: prev.name, deleted_at: null, is_available: avail },
        reason: "Dipulihkan dari arsip Soft Delete",
      });

      revalidateCatalogAndAdmin();
      return { success: true, message: `Menu "${prev.name}" berhasil dipulihkan.` };
    }

    const store = getMemoryStore();
    const prev = store.products.get(productId);
    if (!prev) return { success: false, error: "Produk tidak ditemukan." };
    const oldDeletedAt = prev.deleted_at;
    const avail = (store.stocks.get(productId)?.available_qty ?? 0) > 0;
    prev.deleted_at = null;
    prev.is_available = avail;
    store.products.set(productId, prev);

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "products",
      entityId: productId,
      action: "RESTORE_PRODUCT",
      oldData: { name: prev.name, deleted_at: oldDeletedAt },
      newData: { name: prev.name, deleted_at: null, is_available: avail },
      reason: "Dipulihkan dari arsip Soft Delete",
    });

    revalidateCatalogAndAdmin();
    return { success: true, message: `Menu "${prev.name}" berhasil dipulihkan.` };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal memulihkan menu.") };
  }
}

export async function toggleProductAvailabilityAction(
  productId: string,
  isAvailable: boolean,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    if (await isDatabaseReady()) {
      const prev = await withTimeout(
        prisma.product.findUnique({ where: { id: productId }, include: { stock: true } }),
        ACTION_TIMEOUT_MS,
      );
      if (!prev) return { success: false, error: "Produk tidak ditemukan." };
      if (prev.deleted_at) return { success: false, error: "Pulihkan menu dari arsip terlebih dahulu." };
      if (isAvailable && (prev.stock?.available_qty ?? 0) <= 0) {
        return { success: false, error: "Stok porsi saat ini 0. Tambah stok terlebih dahulu sebelum mengaktifkan." };
      }

      await withTimeout(
        prisma.product.update({ where: { id: productId }, data: { is_available: isAvailable } }),
        ACTION_TIMEOUT_MS,
      );

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "products",
        entityId: productId,
        action: "TOGGLE_PRODUCT_AVAILABILITY",
        oldData: { name: prev.name, is_available: prev.is_available },
        newData: { name: prev.name, is_available: isAvailable },
      });

      revalidateCatalogAndAdmin();
      return { success: true, message: `Status tampil "${prev.name}" diubah ke ${isAvailable ? "Tersedia" : "Nonaktif"}.` };
    }

    const store = getMemoryStore();
    const prev = store.products.get(productId);
    if (!prev) return { success: false, error: "Produk tidak ditemukan." };
    if (prev.deleted_at) return { success: false, error: "Pulihkan menu dari arsip terlebih dahulu." };
    const qty = store.stocks.get(productId)?.available_qty ?? 0;
    if (isAvailable && qty <= 0) {
      return { success: false, error: "Stok porsi saat ini 0. Tambah stok terlebih dahulu sebelum mengaktifkan." };
    }

    const oldAvail = prev.is_available;
    prev.is_available = isAvailable;
    store.products.set(productId, prev);

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "products",
      entityId: productId,
      action: "TOGGLE_PRODUCT_AVAILABILITY",
      oldData: { name: prev.name, is_available: oldAvail },
      newData: { name: prev.name, is_available: isAvailable },
    });

    revalidateCatalogAndAdmin();
    return { success: true, message: `Status tampil "${prev.name}" diubah ke ${isAvailable ? "Tersedia" : "Nonaktif"}.` };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal mengubah status menu.") };
  }
}

/* ----------------------------------------------------------------------------
 * 3. Manajemen Stok Porsi Harian & Penyesuaian Manual (Stock Adjustment)
 * ------------------------------------------------------------------------- */

const DailyStockSchema = z.object({
  productId: z.string().trim().min(1),
  dailyQty: z.coerce.number().int().min(0, "Stok harian tidak boleh negatif."),
  minThreshold: z.coerce.number().int().min(0, "Batas minimum tidak boleh negatif."),
  reasonNote: z.string().trim().max(200).optional(),
});

export async function setDailyStockAction(input: z.infer<typeof DailyStockSchema>): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = DailyStockSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Input stok harian tidak valid." };
    }

    const { productId, dailyQty, minThreshold, reasonNote } = parsed.data;
    const reasonText = reasonNote?.trim() || "Pengaturan kuota stok porsi harian oleh Admin";

    if (await isDatabaseReady()) {
      let productName = productId;
      let oldAvailable = 0;
      let oldThreshold = 5;

      await withTimeout(
        prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({
            where: { id: productId },
            include: { stock: true },
          });
          if (!product) throw new Error("Produk tidak ditemukan.");
          productName = product.name;
          oldAvailable = product.stock?.available_qty ?? 0;
          oldThreshold = product.stock?.min_threshold ?? 5;
          const reserved = product.stock?.reserved_qty ?? 0;
          const dbActorId = await resolveDbActorId(tx, admin.sub);

          if (product.stock) {
            await tx.productStock.update({
              where: { product_id: productId },
              data: { available_qty: dailyQty, min_threshold: minThreshold },
            });
          } else {
            await tx.productStock.create({
              data: {
                id: memoryId("stk"),
                product_id: productId,
                available_qty: dailyQty,
                reserved_qty: 0,
                min_threshold: minThreshold,
              },
            });
          }

          await tx.product.update({
            where: { id: productId },
            data: { is_available: syncProductAvailability(product.deleted_at, dailyQty) },
          });

          await tx.stockMovement.create({
            data: {
              id: memoryId("mov"),
              product_id: productId,
              actor_id: dbActorId,
              movement_type: "INITIAL_STOCK",
              qty_change: dailyQty - oldAvailable,
              available_before: oldAvailable,
              available_after: dailyQty,
              reserved_before: reserved,
              reserved_after: reserved,
              reason: reasonText,
            },
          });
        }),
        ACTION_TIMEOUT_MS,
      );

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "product_stocks",
        entityId: productId,
        action: "SET_DAILY_STOCK",
        oldData: { product_name: productName, available_qty: oldAvailable, min_threshold: oldThreshold },
        newData: { product_name: productName, available_qty: dailyQty, min_threshold: minThreshold },
        reason: reasonText,
      });

      revalidateCatalogAndAdmin();
      return { success: true, message: `Stok harian "${productName}" diatur menjadi ${dailyQty} porsi.` };
    }

    const store = getMemoryStore();
    const product = store.products.get(productId);
    if (!product) return { success: false, error: "Produk tidak ditemukan." };
    const stock = store.stocks.get(productId) ?? {
      product_id: productId,
      available_qty: 0,
      reserved_qty: 0,
      min_threshold: 5,
      updated_at: new Date(),
    };
    const oldAvailable = stock.available_qty;
    const oldThreshold = stock.min_threshold;
    const now = new Date();

    stock.available_qty = dailyQty;
    stock.min_threshold = minThreshold;
    stock.updated_at = now;
    store.stocks.set(productId, stock);
    product.is_available = syncProductAvailability(product.deleted_at, dailyQty);

    store.movements.unshift({
      id: memoryId("mov"),
      product_id: productId,
      actor_id: admin.sub,
      actor_name: admin.name,
      movement_type: "INITIAL_STOCK",
      qty_change: dailyQty - oldAvailable,
      available_before: oldAvailable,
      available_after: dailyQty,
      reserved_before: stock.reserved_qty,
      reserved_after: stock.reserved_qty,
      reason: reasonText,
      created_at: now,
    });

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "product_stocks",
      entityId: productId,
      action: "SET_DAILY_STOCK",
      oldData: { product_name: product.name, available_qty: oldAvailable, min_threshold: oldThreshold },
      newData: { product_name: product.name, available_qty: dailyQty, min_threshold: minThreshold },
      reason: reasonText,
    });

    revalidateCatalogAndAdmin();
    return { success: true, message: `Stok harian "${product.name}" diatur menjadi ${dailyQty} porsi.` };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal mengatur stok harian.") };
  }
}

const AdjustStockSchema = z.object({
  productId: z.string().trim().min(1),
  adjustmentType: z.enum(["RESTOCK", "DAMAGED_EXPIRED", "OPNAME_CORRECTION"]),
  qty: z.coerce.number().int().min(0, "Jumlah porsi tidak boleh negatif."),
  reasonNote: z.string().trim().min(3, "Alasan mutasi stok wajib diisi minimal 3 karakter.").max(200),
});

function computeStockAdjustment(
  availableBefore: number,
  type: AdjustmentReason,
  qty: number,
): { availableAfter: number; qtyChange: number } {
  if (type === "RESTOCK") {
    if (qty <= 0) throw new Error("Jumlah penambahan stok harus lebih dari 0.");
    return { availableAfter: availableBefore + qty, qtyChange: qty };
  }
  if (type === "DAMAGED_EXPIRED") {
    if (qty <= 0) throw new Error("Jumlah pengurangan stok harus lebih dari 0.");
    if (qty > availableBefore) {
      throw new Error(`Jumlah melebihi stok tersedia saat ini (${availableBefore} porsi). Stok tidak boleh negatif.`);
    }
    return { availableAfter: availableBefore - qty, qtyChange: -qty };
  }
  return { availableAfter: qty, qtyChange: qty - availableBefore };
}

export async function adjustStockAction(input: z.infer<typeof AdjustStockSchema>): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdjustStockSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Data penyesuaian stok tidak valid." };
    }

    const { productId, adjustmentType, qty, reasonNote } = parsed.data;
    const fullReason = `${ADJUSTMENT_REASONS[adjustmentType].label}: ${reasonNote}`;

    if (await isDatabaseReady()) {
      let productName = productId;
      let oldAvailable = 0;
      let newAvailable = 0;

      await withTimeout(
        prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) throw new Error("Produk tidak ditemukan.");
          productName = product.name;

          const lockedRows = await tx.$queryRaw<Array<{ available_qty: number; reserved_qty: number }>>`
            SELECT available_qty, reserved_qty FROM product_stocks WHERE product_id = ${productId} FOR UPDATE
          `;

          const current = lockedRows[0];
          oldAvailable = current?.available_qty ?? 0;
          const reserved = current?.reserved_qty ?? 0;

          const { availableAfter, qtyChange } = computeStockAdjustment(oldAvailable, adjustmentType, qty);
          newAvailable = availableAfter;

          if (current) {
            await tx.productStock.update({
              where: { product_id: productId },
              data: { available_qty: availableAfter },
            });
          } else {
            await tx.productStock.create({
              data: {
                id: memoryId("stk"),
                product_id: productId,
                available_qty: availableAfter,
                reserved_qty: 0,
                min_threshold: 5,
              },
            });
          }

          await tx.product.update({
            where: { id: productId },
            data: { is_available: syncProductAvailability(product.deleted_at, availableAfter) },
          });

          const dbActorId = await resolveDbActorId(tx, admin.sub);
          await tx.stockMovement.create({
            data: {
              id: memoryId("mov"),
              product_id: productId,
              actor_id: dbActorId,
              movement_type: adjustmentType,
              qty_change: qtyChange,
              available_before: oldAvailable,
              available_after: availableAfter,
              reserved_before: reserved,
              reserved_after: reserved,
              reason: fullReason,
            },
          });
        }),
        ACTION_TIMEOUT_MS,
      );

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "product_stocks",
        entityId: productId,
        action: `ADJUST_STOCK_${adjustmentType}`,
        oldData: { product_name: productName, available_qty: oldAvailable },
        newData: { product_name: productName, available_qty: newAvailable },
        reason: fullReason,
      });

      revalidateCatalogAndAdmin();
      return {
        success: true,
        message: `Stok "${productName}" disesuaikan: ${oldAvailable} → ${newAvailable} porsi.`,
      };
    }

    const store = getMemoryStore();
    const product = store.products.get(productId);
    if (!product) return { success: false, error: "Produk tidak ditemukan." };
    const stock = store.stocks.get(productId) ?? {
      product_id: productId,
      available_qty: 0,
      reserved_qty: 0,
      min_threshold: 5,
      updated_at: new Date(),
    };

    const oldAvailable = stock.available_qty;
    const { availableAfter, qtyChange } = computeStockAdjustment(oldAvailable, adjustmentType, qty);
    const now = new Date();

    stock.available_qty = availableAfter;
    stock.updated_at = now;
    store.stocks.set(productId, stock);
    product.is_available = syncProductAvailability(product.deleted_at, availableAfter);

    store.movements.unshift({
      id: memoryId("mov"),
      product_id: productId,
      actor_id: admin.sub,
      actor_name: admin.name,
      movement_type: adjustmentType,
      qty_change: qtyChange,
      available_before: oldAvailable,
      available_after: availableAfter,
      reserved_before: stock.reserved_qty,
      reserved_after: stock.reserved_qty,
      reason: fullReason,
      created_at: now,
    });

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "product_stocks",
      entityId: productId,
      action: `ADJUST_STOCK_${adjustmentType}`,
      oldData: { product_name: product.name, available_qty: oldAvailable },
      newData: { product_name: product.name, available_qty: availableAfter },
      reason: fullReason,
    });

    revalidateCatalogAndAdmin();
    return {
      success: true,
      message: `Stok "${product.name}" disesuaikan: ${oldAvailable} → ${availableAfter} porsi.`,
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal melakukan penyesuaian stok.") };
  }
}

/* ----------------------------------------------------------------------------
 * 4. Pengaturan Toko (Master Toggle Buka/Tutup & Pajak PB1)
 * ------------------------------------------------------------------------- */

const StoreSettingsSchema = z.object({
  restaurantName: z.string().trim().min(2, "Nama restoran minimal 2 karakter.").max(120),
  address: z.string().trim().max(500).default(""),
  phoneWhatsapp: z.string().trim().min(6, "Nomor WhatsApp minimal 6 digit.").max(20),
  openingHours: z.string().trim().min(3, "Jam operasional wajib diisi.").max(100),
  isWebOrderingOpen: z.boolean(),
  taxEnabled: z.boolean(),
  taxPercentage: z.coerce
    .number()
    .min(0, "Persentase pajak minimal 0%.")
    .max(100, "Persentase pajak maksimal 100%."),
  digitalExpiryMinutes: z.coerce.number().int().min(5).max(120).default(15),
  cashExpiryMinutes: z.coerce.number().int().min(5).max(240).default(30),
  receiptFooterNote: z.string().trim().max(500).default(""),
  reason: z.string().trim().max(300).optional(),
});

export type StoreSettingsInput = z.infer<typeof StoreSettingsSchema>;

export async function toggleWebOrderingAction(isOpen: boolean, reason?: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const cleanReason =
      reason?.trim() ||
      (isOpen
        ? "Pemesanan web dibuka kembali oleh Admin"
        : "Pemesanan web ditutup sementara via Master Toggle");

    if (await isDatabaseReady()) {
      const current = await withTimeout(
        prisma.restaurantSetting.findFirst({ orderBy: { updated_at: "desc" } }),
        ACTION_TIMEOUT_MS,
      );
      const mem = getMemoryStore().settings;
      const prevOpen = current?.is_web_ordering_open ?? mem.is_web_ordering_open;

      const dbActorId = await resolveDbActorId(prisma, admin.sub);
      const targetId = current?.id ?? "set-main-001";

      await withTimeout(
        prisma.restaurantSetting.upsert({
          where: { id: targetId },
          update: { is_web_ordering_open: isOpen, updated_by: dbActorId },
          create: {
            id: targetId,
            restaurant_name: mem.restaurant_name,
            address: mem.address,
            phone_whatsapp: mem.phone_whatsapp,
            opening_hours: mem.opening_hours,
            is_web_ordering_open: isOpen,
            tax_enabled: mem.tax_enabled,
            tax_percentage: mem.tax_percentage,
            digital_expiry_minutes: mem.digital_expiry_minutes,
            cash_expiry_minutes: mem.cash_expiry_minutes,
            receipt_footer_note: mem.receipt_footer_note,
            updated_by: dbActorId,
          },
        }),
        ACTION_TIMEOUT_MS,
      );

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "restaurant_settings",
        entityId: targetId,
        action: "TOGGLE_WEB_ORDERING",
        oldData: { is_web_ordering_open: prevOpen },
        newData: { is_web_ordering_open: isOpen },
        reason: cleanReason,
      });

      revalidateCatalogAndAdmin();
      return {
        success: true,
        message: isOpen
          ? "Pemesanan online (Web Ordering) sekarang DIBUKA."
          : "Pemesanan online (Web Ordering) sekarang DITUTUP sementara.",
      };
    }

    const store = getMemoryStore();
    const prevOpen = store.settings.is_web_ordering_open;
    store.settings.is_web_ordering_open = isOpen;
    store.settings.updated_at = new Date();

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "restaurant_settings",
      entityId: "set-main-001",
      action: "TOGGLE_WEB_ORDERING",
      oldData: { is_web_ordering_open: prevOpen },
      newData: { is_web_ordering_open: isOpen },
      reason: cleanReason,
    });

    revalidateCatalogAndAdmin();
    return {
      success: true,
      message: isOpen
        ? "Pemesanan online (Web Ordering) sekarang DIBUKA."
        : "Pemesanan online (Web Ordering) sekarang DITUTUP sementara.",
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal mengubah sakelar buka/tutup toko.") };
  }
}

export async function updateStoreSettingsAction(input: StoreSettingsInput): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = StoreSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Pengaturan tidak valid." };
    }

    const d = parsed.data;
    const cleanReason = d.reason?.trim() || "Pembaruan pengaturan operasional restoran & pajak oleh Admin";

    if (await isDatabaseReady()) {
      const current = await withTimeout(
        prisma.restaurantSetting.findFirst({ orderBy: { updated_at: "desc" } }),
        ACTION_TIMEOUT_MS,
      );
      const targetId = current?.id ?? "set-main-001";
      const dbActorId = await resolveDbActorId(prisma, admin.sub);

      const oldSnapshot = current
        ? {
            restaurant_name: current.restaurant_name,
            is_web_ordering_open: current.is_web_ordering_open,
            tax_enabled: current.tax_enabled,
            tax_percentage: Number(current.tax_percentage),
            opening_hours: current.opening_hours,
          }
        : null;

      await withTimeout(
        prisma.restaurantSetting.upsert({
          where: { id: targetId },
          update: {
            restaurant_name: d.restaurantName,
            address: d.address || null,
            phone_whatsapp: d.phoneWhatsapp,
            opening_hours: d.openingHours,
            is_web_ordering_open: d.isWebOrderingOpen,
            tax_enabled: d.taxEnabled,
            tax_percentage: d.taxPercentage,
            digital_expiry_minutes: d.digitalExpiryMinutes,
            cash_expiry_minutes: d.cashExpiryMinutes,
            receipt_footer_note: d.receiptFooterNote || null,
            updated_by: dbActorId,
          },
          create: {
            id: targetId,
            restaurant_name: d.restaurantName,
            address: d.address || null,
            phone_whatsapp: d.phoneWhatsapp,
            opening_hours: d.openingHours,
            is_web_ordering_open: d.isWebOrderingOpen,
            tax_enabled: d.taxEnabled,
            tax_percentage: d.taxPercentage,
            digital_expiry_minutes: d.digitalExpiryMinutes,
            cash_expiry_minutes: d.cashExpiryMinutes,
            receipt_footer_note: d.receiptFooterNote || null,
            updated_by: dbActorId,
          },
        }),
        ACTION_TIMEOUT_MS,
      );

      await recordAuditLog({
        actorId: admin.sub,
        actorName: admin.name,
        actorRole: admin.role,
        entityName: "restaurant_settings",
        entityId: targetId,
        action: "UPDATE_RESTAURANT_SETTINGS",
        oldData: oldSnapshot,
        newData: {
          restaurant_name: d.restaurantName,
          is_web_ordering_open: d.isWebOrderingOpen,
          tax_enabled: d.taxEnabled,
          tax_percentage: d.taxPercentage,
          opening_hours: d.openingHours,
        },
        reason: cleanReason,
      });

      revalidateCatalogAndAdmin();
      return { success: true, message: "Pengaturan toko dan pajak berhasil disimpan." };
    }

    const store = getMemoryStore();
    const oldSnapshot = {
      restaurant_name: store.settings.restaurant_name,
      is_web_ordering_open: store.settings.is_web_ordering_open,
      tax_enabled: store.settings.tax_enabled,
      tax_percentage: store.settings.tax_percentage,
      opening_hours: store.settings.opening_hours,
    };

    store.settings = {
      restaurant_name: d.restaurantName,
      address: d.address,
      phone_whatsapp: d.phoneWhatsapp,
      opening_hours: d.openingHours,
      is_web_ordering_open: d.isWebOrderingOpen,
      tax_enabled: d.taxEnabled,
      tax_percentage: d.taxPercentage,
      digital_expiry_minutes: d.digitalExpiryMinutes,
      cash_expiry_minutes: d.cashExpiryMinutes,
      receipt_footer_note: d.receiptFooterNote,
      updated_at: new Date(),
    };

    await recordAuditLog({
      actorId: admin.sub,
      actorName: admin.name,
      actorRole: admin.role,
      entityName: "restaurant_settings",
      entityId: "set-main-001",
      action: "UPDATE_RESTAURANT_SETTINGS",
      oldData: oldSnapshot,
      newData: {
        restaurant_name: d.restaurantName,
        is_web_ordering_open: d.isWebOrderingOpen,
        tax_enabled: d.taxEnabled,
        tax_percentage: d.taxPercentage,
        opening_hours: d.openingHours,
      },
      reason: cleanReason,
    });

    revalidateCatalogAndAdmin();
    return { success: true, message: "Pengaturan toko dan pajak berhasil disimpan." };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal menyimpan pengaturan toko.") };
  }
}

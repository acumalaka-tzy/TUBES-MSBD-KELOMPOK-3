import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { memoryOrders } from "@/actions/helpers";
import { getMemoryStore } from "@/lib/admin/memory-store";
import {
  sampleProducts,
  sampleRestaurant,
  emojiForCategory,
  emojiForProduct,
  type Category,
  type OptionGroup,
  type Product,
  type RestaurantInfo,
} from "@/lib/menu-data";

export interface Catalog {
  categories: Category[];
  products: Product[];
  restaurant: RestaurantInfo;
  /** "database" = dibaca dari MySQL; "sample" = database belum tersambung / kosong */
  source: "database" | "sample";
}

const BEST_SELLER_COUNT = 4;
const DB_TIMEOUT_MS = 4000;
const PHOTO_EXTENSIONS = [".webp", ".jpg", ".jpeg", ".png", ".avif"];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Database timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function publicFileExists(webPath: string): boolean {
  const clean = webPath.replace(/^\/+/, "");
  try {
    return fs.existsSync(path.join(process.cwd(), "public", clean));
  } catch {
    return false;
  }
}

/**
 * Resolusi cerdas foto produk:
 * 1. Jika `dbImageUrl` adalah URL eksternal (`http://` atau `https://`), gunakan langsung.
 * 2. Cek apakah file foto asli (`.webp`, `.jpg`, `.jpeg`, `.png`, `.avif`) sudah ditaruh di
 *    `public/images/menu/` atau `public/menu/` (berdasarkan nama file di DB maupun ID produk).
 * 3. Jika belum ada foto asli, gunakan ilustrasi contoh `/menu/<id>.svg` yang tersedia di `public/menu/`.
 */
export function resolveProductImage(productId: string, dbImageUrl?: string | null): string | undefined {
  if (dbImageUrl && /^https?:\/\//i.test(dbImageUrl)) {
    return dbImageUrl;
  }

  const baseNames = new Set<string>([productId]);
  if (dbImageUrl) {
    const parsed = path.posix.parse(dbImageUrl);
    if (parsed.name) baseNames.add(parsed.name);
    if (!dbImageUrl.endsWith(".svg") && publicFileExists(dbImageUrl)) {
      return dbImageUrl;
    }
  }

  for (const name of baseNames) {
    for (const dir of ["/images/menu", "/menu"]) {
      for (const ext of PHOTO_EXTENSIONS) {
        const candidate = `${dir}/${name}${ext}`;
        if (publicFileExists(candidate)) {
          return candidate;
        }
      }
    }
  }

  for (const name of baseNames) {
    for (const dir of ["/menu", "/images/menu"]) {
      const svgCandidate = `${dir}/${name}.svg`;
      if (publicFileExists(svgCandidate)) {
        return svgCandidate;
      }
    }
  }

  return dbImageUrl ?? `/menu/${productId}.svg`;
}

function memoryCatalog(): Catalog {
  const store = getMemoryStore();
  const sampleMap = new Map(sampleProducts.map((sp) => [sp.id, sp]));
  const soldByProduct = new Map<string, number>();

  for (const ord of store.demoOrders) {
    if (ord.status !== "CANCELLED") {
      for (const it of ord.items) {
        soldByProduct.set(it.product_id, (soldByProduct.get(it.product_id) ?? 0) + it.quantity);
      }
    }
  }
  for (const ord of memoryOrders.values()) {
    if (ord.status !== "CANCELLED") {
      for (const it of ord.items) {
        const matched = it.product_id
          ? store.products.get(it.product_id)
          : Array.from(store.products.values()).find((p) => p.name === it.product_name_snapshot);
        if (matched) {
          soldByProduct.set(matched.id, (soldByProduct.get(matched.id) ?? 0) + it.quantity);
        }
      }
    }
  }

  const activeCategories = Array.from(store.categories.values())
    .filter((c) => c.deleted_at === null && c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const categoryMap = new Map(activeCategories.map((c) => [c.id, c]));

  const categories: Category[] = activeCategories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    emoji: emojiForCategory(c.slug),
  }));

  const products: Product[] = Array.from(store.products.values())
    .filter((p) => p.deleted_at === null && categoryMap.has(p.category_id))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => {
      const cat = categoryMap.get(p.category_id)!;
      const stock = store.stocks.get(p.id);
      const rawQty = p.is_available ? (stock?.available_qty ?? 0) : 0;
      const minThreshold = stock?.min_threshold ?? 5;
      const base = sampleMap.get(p.id);
      const soldQty = soldByProduct.get(p.id) ?? 0;
      return {
        id: p.id,
        categoryId: p.category_id,
        categoryName: cat.name,
        name: p.name,
        description: p.description ?? "",
        basePrice: p.base_price,
        imageUrl: resolveProductImage(p.id, p.image_url ?? undefined),
        emoji: base?.emoji ?? emojiForProduct(p.name, cat.slug),
        availableQty: rawQty,
        minThreshold,
        popularity: soldQty > 0 ? Math.min(100, (base?.popularity ?? 70) + soldQty) : (base?.popularity ?? 70),
        options: p.option_groups.map((g) => ({
          id: g.id,
          name: g.name,
          required: g.is_required,
          type: (g.max_select > 1 ? "multi" : "single") as "single" | "multi",
          items: g.items
            .filter((it) => it.is_available)
            .map((it) => ({
              id: it.id,
              name: it.name,
              price: it.price_adjustment,
            })),
        })),
      };
    });

  return {
    categories,
    products,
    restaurant: {
      name: store.settings.restaurant_name,
      address: store.settings.address,
      whatsapp: store.settings.phone_whatsapp,
      openingHours: store.settings.opening_hours,
      isWebOrderingOpen: store.settings.is_web_ordering_open,
    },
    source: "sample",
  };
}

async function loadFromDatabase(): Promise<Catalog> {
  const [dbCategories, dbProducts, dbSettings, sold] = await Promise.all([
    prisma.category.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { sort_order: "asc" },
    }),
    prisma.product.findMany({
      where: { deleted_at: null },
      include: {
        stock: true,
        option_groups: {
          include: { option_items: { where: { is_available: true }, orderBy: { sort_order: "asc" } } },
          orderBy: { sort_order: "asc" },
        },
      },
      orderBy: { sort_order: "asc" },
    }),
    prisma.restaurantSetting.findFirst(),
    prisma.orderItem.groupBy({
      by: ["product_id"],
      _sum: { quantity: true },
      where: { order: { status: { not: "CANCELLED" } } },
    }),
  ]);

  if (dbCategories.length === 0 || dbProducts.length === 0) {
    throw new Error("Katalog di database masih kosong");
  }

  const soldMap = new Map(sold.map((s) => [s.product_id, s._sum.quantity ?? 0]));
  const categoryById = new Map(dbCategories.map((c) => [c.id, c]));

  const categories: Category[] = dbCategories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    emoji: emojiForCategory(c.slug),
  }));

  const products: Product[] = dbProducts
    .filter((p) => categoryById.has(p.category_id))
    .map((p, index) => {
      const category = categoryById.get(p.category_id)!;
      const options: OptionGroup[] = p.option_groups.map((g) => ({
        id: g.id,
        name: g.name,
        type: g.max_select > 1 ? "multi" : "single",
        required: g.is_required,
        items: g.option_items.map((i) => ({
          id: i.id,
          name: i.name,
          price: Number(i.price_adjustment),
        })),
      }));

      return {
        id: p.id,
        categoryId: p.category_id,
        categoryName: category.name,
        name: p.name,
        description: p.description ?? "",
        basePrice: Number(p.base_price),
        emoji: emojiForProduct(p.name, category.slug),
        imageUrl: resolveProductImage(p.id, p.image_url),
        availableQty: p.is_available ? (p.stock?.available_qty ?? 0) : 0,
        minThreshold: p.stock?.min_threshold ?? 5,
        popularity: soldMap.get(p.id) ?? 0,
        sortOrder: index,
        options: options.filter((g) => g.items.length > 0),
      } satisfies Product;
    });

  const ranked = [...products]
    .filter((p) => p.availableQty > 0)
    .sort((a, b) => b.popularity - a.popularity || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, BEST_SELLER_COUNT)
    .map((p) => p.id);
  const bestIds = new Set(ranked);
  for (const p of products) p.bestSeller = bestIds.has(p.id);

  const restaurant: RestaurantInfo = dbSettings
    ? {
        name: dbSettings.restaurant_name,
        address: dbSettings.address ?? sampleRestaurant.address,
        whatsapp: dbSettings.phone_whatsapp ?? sampleRestaurant.whatsapp,
        openingHours: dbSettings.opening_hours ?? sampleRestaurant.openingHours,
        isWebOrderingOpen: dbSettings.is_web_ordering_open,
      }
    : sampleRestaurant;

  return { categories, products, restaurant, source: "database" };
}

/**
 * Sumber data tunggal untuk Homepage & Katalog Menu.
 * Dibaca dari MySQL (Prisma). Jika database belum tersambung atau masih kosong,
 * otomatis memakai data contoh agar halaman tetap tampil.
 */
export const getCatalog = cache(async (): Promise<Catalog> => {
  await connection();
  try {
    return await withTimeout(loadFromDatabase(), DB_TIMEOUT_MS);
  } catch (err) {
    console.warn(
      "[catalog] Memakai data contoh:",
      err instanceof Error ? err.message.split("\n").pop() : err,
    );
    return memoryCatalog();
  }
});

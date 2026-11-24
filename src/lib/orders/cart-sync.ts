import { prisma } from "@/lib/prisma";
import { isDatabaseReady } from "@/lib/admin/db";
import { getMemoryStore, memoryId, type MemShoppingCart, type MemShoppingCartItem } from "@/lib/admin/memory-store";

export interface CartItemSyncDto {
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  options: { groupName: string; optionName: string; priceAdjustment: number }[];
  itemNotes?: string;
  subtotal: number;
  imageUrl?: string;
  emoji?: string;
  categoryName?: string;
  maxStock?: number;
}

export interface ServerCartSnapshot {
  status: "ACTIVE" | "CHECKED_OUT" | "REPLACED" | "NOT_FOUND";
  cartToken: string;
  serviceType: "DINE_IN" | "TAKEAWAY";
  orderNotes: string;
  version: number;
  updatedAt: string;
  items: CartItemSyncDto[];
}

function mapMemItemsToDto(items: MemShoppingCartItem[]): CartItemSyncDto[] {
  return items.map((it) => ({
    id: it.client_item_id,
    productId: it.product_id,
    name: it.name,
    unitPrice: it.unit_price,
    quantity: it.quantity,
    options: it.options,
    itemNotes: it.item_notes,
    subtotal: it.subtotal,
    imageUrl: it.image_url,
    emoji: it.emoji,
    categoryName: it.category_name,
    maxStock: it.max_stock,
  }));
}

function mapDtoToMemItems(items: CartItemSyncDto[]): MemShoppingCartItem[] {
  return items.map((it) => ({
    client_item_id: it.id,
    product_id: it.productId,
    name: it.name,
    unit_price: it.unitPrice,
    quantity: it.quantity,
    options: it.options.map((o) => ({
      groupName: o.groupName,
      optionName: o.optionName,
      priceAdjustment: Number(o.priceAdjustment) || 0,
    })),
    item_notes: it.itemNotes,
    subtotal: it.subtotal,
    image_url: it.imageUrl,
    emoji: it.emoji,
    category_name: it.categoryName,
    max_stock: it.maxStock,
  }));
}

export async function getActiveServerCart(params: {
  cartToken?: string | null;
  userId?: string | null;
}): Promise<ServerCartSnapshot> {
  const token = params.cartToken?.trim() || "";
  const userId = params.userId ?? null;

  if (await isDatabaseReady()) {
    try {
      if (token) {
        const byToken = await prisma.shoppingCart.findUnique({
          where: { cart_token: token },
          include: { items: true },
        });
        if (byToken) {
          if (byToken.status !== "ACTIVE") {
            return {
              status: byToken.status as "CHECKED_OUT" | "REPLACED",
              cartToken: byToken.cart_token,
              serviceType: byToken.service_type === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN",
              orderNotes: "",
              version: byToken.version,
              updatedAt: byToken.updated_at.toISOString(),
              items: [],
            };
          }
          return {
            status: "ACTIVE",
            cartToken: byToken.cart_token,
            serviceType: byToken.service_type === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN",
            orderNotes: byToken.order_notes || "",
            version: byToken.version,
            updatedAt: byToken.updated_at.toISOString(),
            items: byToken.items.map((it) => ({
              id: it.client_item_id,
              productId: it.product_id,
              name: it.name,
              unitPrice: Number(it.unit_price),
              quantity: it.quantity,
              options: Array.isArray(it.options_json)
                ? (it.options_json as { groupName: string; optionName: string; priceAdjustment: number }[])
                : [],
              itemNotes: it.item_notes ?? undefined,
              subtotal: Number(it.subtotal),
              imageUrl: it.image_url ?? undefined,
              emoji: it.emoji ?? undefined,
              categoryName: it.category_name ?? undefined,
              maxStock: it.max_stock ?? undefined,
            })),
          };
        }
      }

      if (userId) {
        const activeUserCart = await prisma.shoppingCart.findFirst({
          where: { user_id: userId, status: "ACTIVE" },
          orderBy: { updated_at: "desc" },
          include: { items: true },
        });
        if (activeUserCart) {
          return {
            status: "ACTIVE",
            cartToken: activeUserCart.cart_token,
            serviceType: activeUserCart.service_type === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN",
            orderNotes: activeUserCart.order_notes || "",
            version: activeUserCart.version,
            updatedAt: activeUserCart.updated_at.toISOString(),
            items: activeUserCart.items.map((it) => ({
              id: it.client_item_id,
              productId: it.product_id,
              name: it.name,
              unitPrice: Number(it.unit_price),
              quantity: it.quantity,
              options: Array.isArray(it.options_json)
                ? (it.options_json as { groupName: string; optionName: string; priceAdjustment: number }[])
                : [],
              itemNotes: it.item_notes ?? undefined,
              subtotal: Number(it.subtotal),
              imageUrl: it.image_url ?? undefined,
              emoji: it.emoji ?? undefined,
              categoryName: it.category_name ?? undefined,
              maxStock: it.max_stock ?? undefined,
            })),
          };
        }
      }
    } catch {
      // Fallback ke memory store
    }
  }

  const mem = getMemoryStore();
  if (token) {
    const byToken = mem.shoppingCarts.get(token);
    if (byToken) {
      if (byToken.status !== "ACTIVE") {
        return {
          status: byToken.status,
          cartToken: byToken.cart_token,
          serviceType: byToken.service_type,
          orderNotes: "",
          version: byToken.version,
          updatedAt: byToken.updated_at.toISOString(),
          items: [],
        };
      }
      return {
        status: "ACTIVE",
        cartToken: byToken.cart_token,
        serviceType: byToken.service_type,
        orderNotes: byToken.order_notes,
        version: byToken.version,
        updatedAt: byToken.updated_at.toISOString(),
        items: mapMemItemsToDto(byToken.items),
      };
    }
  }

  if (userId) {
    const activeByUser = [...mem.shoppingCarts.values()]
      .filter((c) => c.user_id === userId && c.status === "ACTIVE")
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())[0];
    if (activeByUser) {
      return {
        status: "ACTIVE",
        cartToken: activeByUser.cart_token,
        serviceType: activeByUser.service_type,
        orderNotes: activeByUser.order_notes,
        version: activeByUser.version,
        updatedAt: activeByUser.updated_at.toISOString(),
        items: mapMemItemsToDto(activeByUser.items),
      };
    }
  }

  return {
    status: "NOT_FOUND",
    cartToken: token,
    serviceType: "DINE_IN",
    orderNotes: "",
    version: 0,
    updatedAt: new Date(0).toISOString(),
    items: [],
  };
}

export async function syncActiveServerCart(params: {
  cartToken: string;
  userId?: string | null;
  serviceType: "DINE_IN" | "TAKEAWAY";
  orderNotes: string;
  items: CartItemSyncDto[];
}): Promise<{
  success: boolean;
  alreadyClosed?: boolean;
  status?: string;
  version?: number;
}> {
  const token = params.cartToken?.trim();
  if (!token) return { success: false };
  const userId = params.userId ?? null;
  const now = new Date();

  if (await isDatabaseReady()) {
    try {
      const existing = await prisma.shoppingCart.findUnique({
        where: { cart_token: token },
      });
      if (existing && existing.status !== "ACTIVE") {
        return { success: false, alreadyClosed: true, status: existing.status };
      }

      const validUser = userId
        ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
        : null;

      const updatedCart = await prisma.$transaction(async (tx) => {
        const cart = existing
          ? await tx.shoppingCart.update({
              where: { id: existing.id },
              data: {
                user_id: validUser?.id ?? existing.user_id,
                service_type: params.serviceType,
                order_notes: params.orderNotes || null,
                version: { increment: 1 },
              },
            })
          : await tx.shoppingCart.create({
              data: {
                cart_token: token,
                user_id: validUser?.id ?? null,
                service_type: params.serviceType,
                order_notes: params.orderNotes || null,
                status: "ACTIVE",
                version: 1,
              },
            });

        await tx.shoppingCartItem.deleteMany({ where: { cart_id: cart.id } });
        if (params.items.length > 0) {
          await tx.shoppingCartItem.createMany({
            data: params.items.map((it) => ({
              cart_id: cart.id,
              client_item_id: it.id,
              product_id: it.productId,
              name: it.name,
              unit_price: it.unitPrice,
              quantity: it.quantity,
              options_json: it.options,
              item_notes: it.itemNotes || null,
              subtotal: it.subtotal,
              image_url: it.imageUrl || null,
              emoji: it.emoji || null,
              category_name: it.categoryName || null,
              max_stock: it.maxStock ?? null,
            })),
          });
        }
        return cart;
      });

      // Sinkronkan juga di memory store bila dipakai bersama
      const mem = getMemoryStore();
      mem.shoppingCarts.set(token, {
        id: updatedCart.id,
        cart_token: token,
        user_id: validUser?.id ?? null,
        service_type: params.serviceType,
        order_notes: params.orderNotes,
        status: "ACTIVE",
        version: updatedCart.version,
        items: mapDtoToMemItems(params.items),
        created_at: updatedCart.created_at,
        updated_at: now,
      });

      return { success: true, status: "ACTIVE", version: updatedCart.version };
    } catch {
      // Fallback ke memory store
    }
  }

  const mem = getMemoryStore();
  const existingMem = mem.shoppingCarts.get(token);
  if (existingMem && existingMem.status !== "ACTIVE") {
    return { success: false, alreadyClosed: true, status: existingMem.status };
  }

  const nextVersion = existingMem ? existingMem.version + 1 : 1;
  const nextMem: MemShoppingCart = {
    id: existingMem?.id ?? memoryId("cart"),
    cart_token: token,
    user_id: userId ?? existingMem?.user_id ?? null,
    service_type: params.serviceType,
    order_notes: params.orderNotes,
    status: "ACTIVE",
    version: nextVersion,
    items: mapDtoToMemItems(params.items),
    created_at: existingMem?.created_at ?? now,
    updated_at: now,
  };
  mem.shoppingCarts.set(token, nextMem);

  return { success: true, status: "ACTIVE", version: nextVersion };
}

/**
 * Ganti keranjang lama dengan keranjang baru yang bersih:
 * menandai keranjang lama (serta keranjang aktif user lain) sebagai REPLACED
 * agar item dari keranjang sebelumnya tidak pernah terbawa ke keranjang baru.
 */
export async function replaceWithNewServerCart(params: {
  previousCartToken?: string | null;
  newCartToken: string;
  userId?: string | null;
  serviceType?: "DINE_IN" | "TAKEAWAY";
  orderNotes?: string;
  items?: CartItemSyncDto[];
}): Promise<{ success: boolean; cartToken: string }> {
  const prevToken = params.previousCartToken?.trim();
  const newToken = params.newCartToken.trim();
  const userId = params.userId ?? null;
  const serviceType = params.serviceType ?? "DINE_IN";
  const orderNotes = params.orderNotes ?? "";
  const newItems = params.items ?? [];
  const now = new Date();

  if (await isDatabaseReady()) {
    try {
      const validUser = userId
        ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
        : null;

      await prisma.$transaction(async (tx) => {
        const toReplace = await tx.shoppingCart.findMany({
          where: {
            status: "ACTIVE",
            OR: [
              ...(prevToken ? [{ cart_token: prevToken }] : []),
              ...(validUser ? [{ user_id: validUser.id }] : []),
            ],
          },
          select: { id: true },
        });
        if (toReplace.length > 0) {
          const ids = toReplace.map((c) => c.id);
          await tx.shoppingCartItem.deleteMany({ where: { cart_id: { in: ids } } });
          await tx.shoppingCart.updateMany({
            where: { id: { in: ids } },
            data: { status: "REPLACED", order_notes: null },
          });
        }

        const created = await tx.shoppingCart.upsert({
          where: { cart_token: newToken },
          update: {
            user_id: validUser?.id ?? null,
            service_type: serviceType,
            order_notes: orderNotes || null,
            status: "ACTIVE",
            version: { increment: 1 },
          },
          create: {
            cart_token: newToken,
            user_id: validUser?.id ?? null,
            service_type: serviceType,
            order_notes: orderNotes || null,
            status: "ACTIVE",
            version: 1,
          },
        });

        await tx.shoppingCartItem.deleteMany({ where: { cart_id: created.id } });
        if (newItems.length > 0) {
          await tx.shoppingCartItem.createMany({
            data: newItems.map((it) => ({
              cart_id: created.id,
              client_item_id: it.id,
              product_id: it.productId,
              name: it.name,
              unit_price: it.unitPrice,
              quantity: it.quantity,
              options_json: it.options,
              item_notes: it.itemNotes || null,
              subtotal: it.subtotal,
              image_url: it.imageUrl || null,
              emoji: it.emoji || null,
              category_name: it.categoryName || null,
              max_stock: it.maxStock ?? null,
            })),
          });
        }
      });
    } catch {
      // Fallback ke memory store
    }
  }

  const mem = getMemoryStore();
  for (const cart of mem.shoppingCarts.values()) {
    if (
      cart.status === "ACTIVE" &&
      ((prevToken && cart.cart_token === prevToken) || (userId && cart.user_id === userId))
    ) {
      cart.status = "REPLACED";
      cart.items = [];
      cart.order_notes = "";
      cart.updated_at = now;
    }
  }

  mem.shoppingCarts.set(newToken, {
    id: memoryId("cart"),
    cart_token: newToken,
    user_id: userId,
    service_type: serviceType,
    order_notes: orderNotes,
    status: "ACTIVE",
    version: 1,
    items: mapDtoToMemItems(newItems),
    created_at: now,
    updated_at: now,
  });

  return { success: true, cartToken: newToken };
}

/**
 * Bersihkan / tandai selesai keranjang aktif setelah checkout berhasil di Database (dalam transaksi ACID).
 * Tidak dipanggil bila checkout gagal.
 */
export async function finalizeDbCartAfterCheckout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  params: {
    cartToken?: string | null;
    userId?: string | null;
    processedItemIds?: string[];
  }
): Promise<void> {
  const token = params.cartToken?.trim();
  const userId = params.userId ?? null;
  if (!token && !userId) return;

  const targetCarts = await tx.shoppingCart.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        ...(token ? [{ cart_token: token }] : []),
        ...(userId ? [{ user_id: userId }] : []),
      ],
    },
    include: { items: true },
  });

  const processedSet =
    params.processedItemIds && params.processedItemIds.length > 0
      ? new Set(params.processedItemIds)
      : null;

  for (const cart of targetCarts) {
    if (!processedSet) {
      await tx.shoppingCartItem.deleteMany({ where: { cart_id: cart.id } });
      await tx.shoppingCart.update({
        where: { id: cart.id },
        data: { status: "CHECKED_OUT", order_notes: null, version: { increment: 1 } },
      });
    } else {
      const remaining = cart.items.filter(
        (it: { client_item_id: string }) => !processedSet.has(it.client_item_id)
      );
      await tx.shoppingCartItem.deleteMany({
        where: { cart_id: cart.id, client_item_id: { in: [...processedSet] } },
      });
      if (remaining.length === 0) {
        await tx.shoppingCart.update({
          where: { id: cart.id },
          data: { status: "CHECKED_OUT", order_notes: null, version: { increment: 1 } },
        });
      } else {
        await tx.shoppingCart.update({
          where: { id: cart.id },
          data: { version: { increment: 1 } },
        });
      }
    }
  }
}

/**
 * Bersihkan / tandai selesai keranjang aktif setelah checkout berhasil di Memory Store.
 * Tidak dipanggil bila checkout gagal.
 */
export function finalizeMemoryCartAfterCheckout(params: {
  cartToken?: string | null;
  userId?: string | null;
  processedItemIds?: string[];
}): void {
  const token = params.cartToken?.trim();
  const userId = params.userId ?? null;
  if (!token && !userId) return;

  const mem = getMemoryStore();
  const now = new Date();
  const processedSet =
    params.processedItemIds && params.processedItemIds.length > 0
      ? new Set(params.processedItemIds)
      : null;

  for (const cart of mem.shoppingCarts.values()) {
    const matches =
      cart.status === "ACTIVE" &&
      ((token && cart.cart_token === token) || (userId && cart.user_id === userId));
    if (!matches) continue;

    if (!processedSet) {
      cart.items = [];
      cart.status = "CHECKED_OUT";
      cart.order_notes = "";
      cart.version += 1;
      cart.updated_at = now;
    } else {
      cart.items = cart.items.filter((it) => !processedSet.has(it.client_item_id));
      cart.version += 1;
      cart.updated_at = now;
      if (cart.items.length === 0) {
        cart.status = "CHECKED_OUT";
        cart.order_notes = "";
      }
    }
  }
}

"use server";

import { getSession } from "@/lib/auth/session";
import {
  getActiveServerCart,
  replaceWithNewServerCart,
  syncActiveServerCart,
  type CartItemSyncDto,
  type ServerCartSnapshot,
} from "@/lib/orders/cart-sync";

export async function getActiveCartAction(input?: {
  cartToken?: string | null;
}): Promise<ServerCartSnapshot> {
  const session = await getSession().catch(() => null);
  return getActiveServerCart({
    cartToken: input?.cartToken,
    userId: session?.sub ?? null,
  });
}

export async function syncActiveCartAction(input: {
  cartToken: string;
  serviceType: "DINE_IN" | "TAKEAWAY";
  orderNotes: string;
  items: CartItemSyncDto[];
}): Promise<{
  success: boolean;
  alreadyClosed?: boolean;
  status?: string;
  version?: number;
}> {
  const session = await getSession().catch(() => null);
  return syncActiveServerCart({
    cartToken: input.cartToken,
    userId: session?.sub ?? null,
    serviceType: input.serviceType,
    orderNotes: input.orderNotes,
    items: input.items,
  });
}

export async function replaceWithNewCartAction(input: {
  previousCartToken?: string | null;
  newCartToken: string;
  serviceType?: "DINE_IN" | "TAKEAWAY";
  orderNotes?: string;
  items?: CartItemSyncDto[];
}): Promise<{ success: boolean; cartToken: string }> {
  const session = await getSession().catch(() => null);
  return replaceWithNewServerCart({
    previousCartToken: input.previousCartToken,
    newCartToken: input.newCartToken,
    userId: session?.sub ?? null,
    serviceType: input.serviceType,
    orderNotes: input.orderNotes,
    items: input.items,
  });
}

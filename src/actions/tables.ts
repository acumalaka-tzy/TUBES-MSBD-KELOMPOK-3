"use server";

import { prisma } from "@/lib/prisma";
import { getMemoryStore } from "@/lib/admin/memory-store";
import { isDatabaseReady } from "@/lib/admin/db";
import { getSession } from "@/lib/auth/session";
import { checkTableSessionOwnershipForClient, normalizeTableNumber } from "@/lib/orders/table-session";
import { TableItem } from "./types";
import { cleanupExpiredOrders } from "./orders";

export async function getTablesList(context?: {
  customerPhone?: string | null;
  sessionTokens?: Record<string, string> | null;
}): Promise<TableItem[]> {
  await cleanupExpiredOrders().catch(() => {});
  const authSession = await getSession().catch(() => null);
  const tokensMap = context?.sessionTokens ?? {};

  const resolveOwnedTokenForTable = (tableNumber: string): string | null => {
    const { raw, clean, padded } = normalizeTableNumber(tableNumber);
    return tokensMap[raw] || tokensMap[clean] || tokensMap[padded] || null;
  };

  try {
    if (await isDatabaseReady()) {
      const tables = await prisma.table.findMany({
        where: { is_active: true },
        orderBy: { table_number: "asc" },
      });
      if (tables.length > 0) {
        return Promise.all(
          tables.map(async (t) => {
            const num = String(t.table_number).replace(/^0+/, "") || String(t.table_number);
            let activeSessionId: string | null = null;
            let activeSessionOwned = false;
            if (t.status === "OCCUPIED") {
              const ownership = await checkTableSessionOwnershipForClient({
                tableId: t.id,
                tableNumber: t.table_number,
                userId: authSession?.sub ?? null,
                customerPhone: context?.customerPhone ?? null,
                tableSessionToken: resolveOwnedTokenForTable(t.table_number),
              });
              activeSessionId = ownership.activeSessionId;
              activeSessionOwned = ownership.activeSessionOwned;
            }
            return {
              id: t.id,
              table_number: t.table_number,
              name: `Meja ${num}`,
              status: t.status,
              activeSessionId,
              activeSessionOwned,
            };
          })
        );
      }
    }
  } catch (err: unknown) {
    console.warn(
      "Gagal query tabel meja di database, menggunakan fallback:",
      err instanceof Error ? err.message : String(err)
    );
  }

  const mem = getMemoryStore();
  const activeTables = [...mem.tables.values()]
    .filter((t) => t.is_active)
    .sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true }));

  return Promise.all(
    activeTables.map(async (t) => {
      const num = String(t.table_number).replace(/^0+/, "") || String(t.table_number);
      let activeSessionId: string | null = null;
      let activeSessionOwned = false;
      if (t.status === "OCCUPIED") {
        const ownership = await checkTableSessionOwnershipForClient({
          tableId: t.id,
          tableNumber: t.table_number,
          userId: authSession?.sub ?? null,
          customerPhone: context?.customerPhone ?? null,
          tableSessionToken: resolveOwnedTokenForTable(t.table_number),
        });
        activeSessionId = ownership.activeSessionId;
        activeSessionOwned = ownership.activeSessionOwned;
      }
      return {
        id: t.id,
        table_number: t.table_number,
        name: `Meja ${num}`,
        status: t.status,
        activeSessionId,
        activeSessionOwned,
      };
    })
  );
}

import { connection } from "next/server";
import { getPublicStoreSettings } from "@/lib/admin/queries";
import { getMemoryStore } from "@/lib/admin/memory-store";
import { isDatabaseReady, withTimeout } from "@/lib/admin/db";
import { getCatalog } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export interface OutletTableStats {
  totalTables: number;
  availableTables: number;
  occupiedTables: number;
  totalSeats: number;
}

const TABLE_STATS_TIMEOUT_MS = 3500;

function computeTableStats(
  rows: ReadonlyArray<{ status: string; capacity: number }>,
): OutletTableStats {
  let availableTables = 0;
  let occupiedTables = 0;
  let totalSeats = 0;

  for (const row of rows) {
    totalSeats += row.capacity;
    if (row.status === "AVAILABLE") availableTables += 1;
    else if (row.status === "OCCUPIED") occupiedTables += 1;
  }

  return {
    totalTables: rows.length,
    availableTables,
    occupiedTables,
    totalSeats,
  };
}

async function loadTableStats(): Promise<OutletTableStats> {
  if (await isDatabaseReady()) {
    try {
      const rows = await withTimeout(
        prisma.table.findMany({
          where: { is_active: true },
          select: {
            status: true,
            capacity: true,
            orders: {
              where: {
                service_type: "DINE_IN",
                status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] },
              },
              select: { id: true },
            },
          },
        }),
        TABLE_STATS_TIMEOUT_MS,
      );
      if (rows.length > 0) {
        return computeTableStats(
          rows.map((row) => ({
            capacity: row.capacity,
            status: row.status === "OCCUPIED" || row.orders.length > 0 ? "OCCUPIED" : row.status,
          })),
        );
      }
    } catch (err) {
      console.warn(
        "[info] Gagal membaca statistik meja dari database, memakai fallback:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const memRows = [...getMemoryStore().tables.values()].filter((t) => t.is_active);
  return computeTableStats(memRows);
}

/** Loads restaurant settings, catalog summary, and live table capacity for the /info page. */
export async function getOutletSnapshot() {
  await connection();
  const [catalog, storeSettings, tableStats] = await Promise.all([
    getCatalog(),
    getPublicStoreSettings(),
    loadTableStats(),
  ]);

  return {
    catalog,
    storeSettings,
    tableStats,
  };
}

"use server";

import { prisma } from "@/lib/prisma";
import { getMemoryStore } from "@/lib/admin/memory-store";
import { TableItem } from "./types";

export async function getTablesList(): Promise<TableItem[]> {
  try {
    const tables = await prisma.table.findMany({
      where: { is_active: true },
      orderBy: { table_number: "asc" },
    });
    if (tables.length > 0) {
      return tables.map((t) => ({
        id: t.id,
        table_number: t.table_number,
        name: t.name,
        status: t.status,
      }));
    }
  } catch (err: unknown) {
    console.warn(
      "Gagal query tabel meja di database, menggunakan fallback:",
      err instanceof Error ? err.message : String(err),
    );
  }

  const mem = getMemoryStore();
  return [...mem.tables.values()]
    .filter((t) => t.is_active)
    .sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true }))
    .map((t) => ({
      id: t.id,
      table_number: t.table_number,
      name: t.name,
      status: t.status,
    }));
}



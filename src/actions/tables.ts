"use server";

import { prisma } from "@/lib/prisma";
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

  return [
    { id: "tbl-01", table_number: "01", name: "Meja 01 (Indoor)", status: "AVAILABLE" },
    { id: "tbl-02", table_number: "02", name: "Meja 02 (Indoor)", status: "AVAILABLE" },
    { id: "tbl-03", table_number: "03", name: "Meja 03 (Indoor)", status: "AVAILABLE" },
    { id: "tbl-04", table_number: "04", name: "Meja 04 (Teras)", status: "AVAILABLE" },
    { id: "tbl-05", table_number: "05", name: "Meja 05 (Teras)", status: "AVAILABLE" },
    { id: "tbl-06", table_number: "06", name: "Meja 06 (VIP)", status: "AVAILABLE" },
  ];
}


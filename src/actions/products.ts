"use server";

import { prisma } from "@/lib/prisma";
import { AvailableProduct } from "./types";

export async function getAvailableProducts(): Promise<AvailableProduct[]> {
  try {
    const products = await prisma.product.findMany({
      where: { is_available: true, deleted_at: null },
      include: {
        category: true,
        stock: true,
        option_groups: {
          include: {
            option_items: {
              where: { is_available: true },
              orderBy: { sort_order: "asc" },
            },
          },
          orderBy: { sort_order: "asc" },
        },
      },
      orderBy: { sort_order: "asc" },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category.name,
      base_price: Number(p.base_price),
      description: p.description,
      available_qty: p.stock?.available_qty ?? 0,
      option_groups: p.option_groups.map((g) => ({
        id: g.id,
        name: g.name,
        is_required: g.is_required,
        items: g.option_items.map((i) => ({
          id: i.id,
          name: i.name,
          price_adjustment: Number(i.price_adjustment),
        })),
      })),
    }));
  } catch (err: any) {
    console.error("Gagal mengambil produk dari database:", err.message);
    return [];
  }
}

import { revalidatePath } from "next/cache";
import type { OrderDetailData } from "./types";
import { getMemoryStore } from "@/lib/admin/memory-store";

export function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Dipanggil di luar request context Next.js (misal script test)
  }
}

const globalForOrders = globalThis as unknown as {
  __warkopMemoryOrders?: Map<string, OrderDetailData>;
};

function createInitialMemoryOrders(): Map<string, OrderDetailData> {
  const map = new Map<string, OrderDetailData>();
  const now = Date.now();
  const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");

  const seedOrders: OrderDetailData[] = [
    {
      id: "mock-ord-101",
      order_number: `ORD-${dateStr}-101`,
      user_id: null,
      customer_name: "Rizky Pratama",
      customer_phone: "081265439876",
      tracking_token: "trk_seed_101",
      source: "WEB",
      service_type: "DINE_IN",
      status: "PENDING",
      subtotal: 76000,
      tax_amount: 7600,
      total_amount: 83600,
      notes: "Sambal dipisah untuk 1 porsi",
      expires_at: new Date(now + 25 * 60 * 1000),
      created_at: new Date(now - 4 * 60 * 1000),
      table: { table_number: "04", name: "Meja 04 (Outdoor Depan)" },
      items: [
        {
          id: "mock-item-101-1",
          product_id: "prd-bangladesh-06",
          product_name_snapshot: "Indomie Bangladesh Spesial",
          unit_price_snapshot: 18000,
          quantity: 2,
          subtotal: 44000,
          item_notes: "Kuah nyemek pas",
          options: [
            {
              option_group_name_snapshot: "Level Pedas",
              option_name_snapshot: "Pedas Ekstra",
              price_adjustment_snapshot: 0,
            },
            {
              option_group_name_snapshot: "Tambahan Topping",
              option_name_snapshot: "Tambah Telur Setengah Matang",
              price_adjustment_snapshot: 4000,
            },
          ],
        },
        {
          id: "mock-item-101-2",
          product_id: "prd-sanger-01",
          product_name_snapshot: "Kopi Sanger Espresso",
          unit_price_snapshot: 14000,
          quantity: 2,
          subtotal: 32000,
          item_notes: "Es batu sedikit",
          options: [
            {
              option_group_name_snapshot: "Suhu Penyajian",
              option_name_snapshot: "Dingin (Es)",
              price_adjustment_snapshot: 2000,
            },
            {
              option_group_name_snapshot: "Tingkat Manis",
              option_name_snapshot: "Manis Normal",
              price_adjustment_snapshot: 0,
            },
          ],
        },
      ],
      payment: {
        id: "mock-pay-101",
        method: "CASH",
        status: "UNPAID",
        amount_due: 83600,
        amount_paid: 0,
        change_amount: 0,
        paid_at: null,
      },
    },
    {
      id: "mock-ord-102",
      order_number: `ORD-${dateStr}-102`,
      user_id: null,
      customer_name: "Siti Rahmawati",
      customer_phone: "081377889900",
      tracking_token: "trk_seed_102",
      source: "WEB",
      service_type: "DINE_IN",
      status: "PREPARING",
      subtotal: 35000,
      tax_amount: 3500,
      total_amount: 38500,
      notes: null,
      expires_at: new Date(now + 10 * 60 * 1000),
      created_at: new Date(now - 14 * 60 * 1000),
      table: { table_number: "02", name: "Meja 02 (Indoor)" },
      items: [
        {
          id: "mock-item-102-1",
          product_id: "prd-nasgor-07",
          product_name_snapshot: "Nasi Goreng Kampung Agam",
          unit_price_snapshot: 22000,
          quantity: 1,
          subtotal: 22000,
          item_notes: "Tanpa bawang goreng",
          options: [
            {
              option_group_name_snapshot: "Level Pedas",
              option_name_snapshot: "Pedas Sedang (Standar)",
              price_adjustment_snapshot: 0,
            },
          ],
        },
        {
          id: "mock-item-102-2",
          product_id: "prd-tehtarik-02",
          product_name_snapshot: "Teh Tarik Aceh",
          unit_price_snapshot: 13000,
          quantity: 1,
          subtotal: 13000,
          item_notes: null,
          options: [
            {
              option_group_name_snapshot: "Suhu Penyajian",
              option_name_snapshot: "Panas",
              price_adjustment_snapshot: 0,
            },
          ],
        },
      ],
      payment: {
        id: "mock-pay-102",
        method: "QRIS",
        status: "PAID",
        amount_due: 38500,
        amount_paid: 38500,
        change_amount: 0,
        paid_at: new Date(now - 12 * 60 * 1000),
      },
    },
    {
      id: "mock-ord-103",
      order_number: `ORD-${dateStr}-103`,
      user_id: null,
      customer_name: "Andi Wijaya",
      customer_phone: "085211223344",
      tracking_token: "trk_seed_103",
      source: "POS",
      service_type: "TAKEAWAY",
      status: "READY",
      subtotal: 30000,
      tax_amount: 3000,
      total_amount: 33000,
      notes: "Bungkus terpisah",
      expires_at: null,
      created_at: new Date(now - 22 * 60 * 1000),
      table: null,
      items: [
        {
          id: "mock-item-103-1",
          product_id: "prd-rotibakar-08",
          product_name_snapshot: "Roti Bakar Cokelat Keju",
          unit_price_snapshot: 15000,
          quantity: 2,
          subtotal: 30000,
          item_notes: "Panggang agak garing",
          options: [],
        },
      ],
      payment: {
        id: "mock-pay-103",
        method: "CASH",
        status: "PAID",
        amount_due: 33000,
        amount_paid: 50000,
        change_amount: 17000,
        paid_at: new Date(now - 21 * 60 * 1000),
      },
    },
  ];

  for (const ord of seedOrders) {
    map.set(ord.order_number, ord);
  }

  // Sinkronkan status meja terisi pada memory store
  try {
    const store = getMemoryStore();
    const tbl02 = store.tables.get("tbl-02");
    if (tbl02) tbl02.status = "OCCUPIED";
    const tbl04 = store.tables.get("tbl-04");
    if (tbl04) tbl04.status = "OCCUPIED";
  } catch {
    // Abaikan jika store belum siap
  }

  return map;
}

// Fallback in-memory storage jika MySQL belum terkoneksi saat pengujian mandiri
export const memoryOrders: Map<string, OrderDetailData> =
  globalForOrders.__warkopMemoryOrders ??
  (globalForOrders.__warkopMemoryOrders = createInitialMemoryOrders());



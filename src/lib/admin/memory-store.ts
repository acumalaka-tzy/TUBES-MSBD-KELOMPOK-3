/**
 * Penyimpanan in-memory Dashboard Admin.
 *
 * Dipakai otomatis ketika database MySQL belum tersambung / belum di-seed,
 * sehingga seluruh fitur admin (CRUD menu, stok, audit log, pengaturan) tetap
 * bisa diuji end-to-end. Struktur kolom mengikuti `prisma/schema.prisma`.
 * Data disimpan di `globalThis` agar bertahan saat hot-reload dev server.
 */
import { sampleCategories, sampleProducts, sampleRestaurant } from "@/lib/menu-data";
import type { StockMovementType } from "./types";

export interface MemCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  deleted_at: Date | null;
  created_at: Date;
}

export interface MemOptionItem {
  id: string;
  name: string;
  price_adjustment: number;
  is_available: boolean;
}

export interface MemOptionGroup {
  id: string;
  name: string;
  is_required: boolean;
  max_select: number;
  items: MemOptionItem[];
}

export interface MemProduct {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  deleted_at: Date | null;
  created_at: Date;
  option_groups: MemOptionGroup[];
}

export interface MemStock {
  product_id: string;
  available_qty: number;
  reserved_qty: number;
  min_threshold: number;
  updated_at: Date;
}

export interface MemStockMovement {
  id: string;
  product_id: string;
  actor_id: string | null;
  actor_name: string | null;
  movement_type: StockMovementType;
  qty_change: number;
  available_before: number;
  available_after: number;
  reserved_before: number;
  reserved_after: number;
  reason: string | null;
  created_at: Date;
}

export interface MemAuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  entity_name: string;
  entity_id: string;
  action: string;
  old_data: unknown;
  new_data: unknown;
  reason: string | null;
  created_at: Date;
}

export interface MemSettings {
  restaurant_name: string;
  address: string;
  phone_whatsapp: string;
  opening_hours: string;
  is_web_ordering_open: boolean;
  tax_enabled: boolean;
  tax_percentage: number;
  digital_expiry_minutes: number;
  cash_expiry_minutes: number;
  receipt_footer_note: string;
  updated_at: Date | null;
}

/** Ringkasan pesanan contoh untuk analitik dashboard saat database belum aktif. */
export interface MemAnalyticsOrder {
  id: string;
  status: string;
  created_at: Date;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  items: { product_id: string; name: string; quantity: number; subtotal: number }[];
}

export interface MemTable {
  id: string;
  table_number: string;
  name: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "INACTIVE";
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MemTableQrCode {
  id: string;
  table_id: string;
  token: string;
  is_active: boolean;
  generated_by: string | null;
  created_at: Date;
  revoked_at: Date | null;
}

export interface AdminMemoryStore {
  categories: Map<string, MemCategory>;
  products: Map<string, MemProduct>;
  stocks: Map<string, MemStock>;
  movements: MemStockMovement[];
  auditLogs: MemAuditLog[];
  settings: MemSettings;
  demoOrders: MemAnalyticsOrder[];
  tables: Map<string, MemTable>;
  tableQrCodes: Map<string, MemTableQrCode[]>;
}

function createStore(): AdminMemoryStore {
  const now = new Date();
  const categories = new Map<string, MemCategory>(
    sampleCategories.map((c, i) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        sort_order: i + 1,
        is_active: true,
        deleted_at: null,
        created_at: now,
      },
    ]),
  );

  const products = new Map<string, MemProduct>();
  const stocks = new Map<string, MemStock>();
  sampleProducts.forEach((p, i) => {
    products.set(p.id, {
      id: p.id,
      category_id: p.categoryId,
      name: p.name,
      description: p.description,
      base_price: p.basePrice,
      image_url: p.imageUrl ?? null,
      is_available: p.availableQty > 0,
      sort_order: i + 1,
      deleted_at: null,
      created_at: now,
      option_groups: p.options.map((g) => ({
        id: `${p.id}-${g.id}`,
        name: g.name,
        is_required: g.required,
        max_select: g.type === "multi" ? g.items.length : 1,
        items: g.items.map((it) => ({
          id: `${p.id}-${it.id}`,
          name: it.name,
          price_adjustment: it.price,
          is_available: true,
        })),
      })),
    });
    stocks.set(p.id, {
      product_id: p.id,
      available_qty: p.availableQty,
      reserved_qty: 0,
      min_threshold: p.minThreshold,
      updated_at: now,
    });
  });

  const initialTables = [
    { number: "01", name: "Meja 1", capacity: 4 },
    { number: "02", name: "Meja 2", capacity: 4 },
    { number: "03", name: "Meja 3", capacity: 6 },
    { number: "04", name: "Meja 4", capacity: 2 },
    { number: "05", name: "Meja 5", capacity: 4 },
    { number: "06", name: "Meja 6", capacity: 8 },
  ];

  const defaultTables = Array.from({ length: 40 }, (_, index) => {
    const existing = initialTables[index];
    if (existing) return existing;

    const num = index + 1;
    const padded = String(num).padStart(2, "0");
    return {
      number: padded,
      name: `Meja ${num}`,
      capacity: num % 10 === 0 ? 8 : num % 5 === 0 ? 6 : num % 4 === 0 ? 2 : 4,
    };
  });

  const tables = new Map<string, MemTable>();
  const tableQrCodes = new Map<string, MemTableQrCode[]>();

  defaultTables.forEach((t) => {
    const tableId = `tbl-${t.number}`;
    tables.set(tableId, {
      id: tableId,
      table_number: t.number,
      name: t.name,
      capacity: t.capacity,
      status: "AVAILABLE",
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    const qrToken = `qr_tbl_${t.number}_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
    tableQrCodes.set(tableId, [
      {
        id: `qr-${tableId}`,
        table_id: tableId,
        token: qrToken,
        is_active: true,
        generated_by: "usr-admin-001",
        created_at: now,
        revoked_at: null,
      },
    ]);
  });

  return {
    categories,
    products,
    stocks,
    movements: [],
    auditLogs: [],
    settings: {
      restaurant_name: sampleRestaurant.name,
      address: sampleRestaurant.address,
      phone_whatsapp: sampleRestaurant.whatsapp,
      opening_hours: sampleRestaurant.openingHours,
      is_web_ordering_open: sampleRestaurant.isWebOrderingOpen,
      tax_enabled: false,
      tax_percentage: 0,
      digital_expiry_minutes: 15,
      cash_expiry_minutes: 30,
      receipt_footer_note: "Terima kasih telah berkunjung ke Warkop Agam!",
      updated_at: null,
    },
    demoOrders: [],
    tables,
    tableQrCodes,
  };
}

const globalForStore = globalThis as unknown as { __warkopAdminStore?: AdminMemoryStore };

export function getMemoryStore(): AdminMemoryStore {
  if (!globalForStore.__warkopAdminStore) {
    globalForStore.__warkopAdminStore = createStore();
  }
  return globalForStore.__warkopAdminStore;
}

export function memoryId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

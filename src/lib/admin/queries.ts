import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { memoryOrders } from "@/actions/helpers";
import { getStockStatus } from "@/lib/menu-data";
import { invalidateDatabaseCheck, isDatabaseReady, withTimeout } from "./db";
import { getMemoryStore } from "./memory-store";
import type {
  AdminAuditLog,
  AdminCategory,
  AdminProduct,
  AdminSettings,
  AdminStockMovement,
  DashboardSummary,
  DataSource,
  PeriodKey,
  PublicStoreSettings,
  SalesPoint,
  StockMovementType,
  TopProduct,
} from "./types";

const QUERY_TIMEOUT_MS = 5000;

/**
 * Menjalankan query database bila tersedia; jika gagal otomatis memakai
 * penyimpanan memori agar halaman admin tetap tampil.
 */
async function readWithFallback<T>(
  label: string,
  fromDb: () => Promise<T>,
  fromMemory: () => T,
): Promise<{ data: T; source: DataSource }> {
  if (await isDatabaseReady()) {
    try {
      return { data: await withTimeout(fromDb(), QUERY_TIMEOUT_MS), source: "database" };
    } catch (err) {
      invalidateDatabaseCheck();
      console.warn(`[admin:${label}] Query MySQL gagal, memakai data memori:`, err instanceof Error ? err.message.split("\n").pop() : err);
    }
  }
  return { data: fromMemory(), source: "memory" };
}

export async function getDataSource(): Promise<DataSource> {
  return (await isDatabaseReady()) ? "database" : "memory";
}

/* ----------------------------------------------------------------------------
 * Pengaturan Toko
 * ------------------------------------------------------------------------- */

export async function getAdminSettings() {
  return readWithFallback<AdminSettings>(
    "settings",
    async () => {
      const s = await prisma.restaurantSetting.findFirst({ orderBy: { updated_at: "desc" } });
      const mem = getMemoryStore().settings;
      if (!s) {
        return memorySettingsToDto(mem);
      }
      return {
        restaurantName: s.restaurant_name,
        address: s.address ?? "",
        phoneWhatsapp: s.phone_whatsapp ?? "",
        openingHours: s.opening_hours ?? "",
        isWebOrderingOpen: s.is_web_ordering_open,
        taxEnabled: s.tax_enabled,
        taxPercentage: Number(s.tax_percentage),
        digitalExpiryMinutes: s.digital_expiry_minutes,
        cashExpiryMinutes: s.cash_expiry_minutes,
        receiptFooterNote: s.receipt_footer_note ?? "",
        updatedAt: s.updated_at.toISOString(),
      };
    },
    () => memorySettingsToDto(getMemoryStore().settings),
  );
}

function memorySettingsToDto(s: ReturnType<typeof getMemoryStore>["settings"]): AdminSettings {
  return {
    restaurantName: s.restaurant_name,
    address: s.address,
    phoneWhatsapp: s.phone_whatsapp,
    openingHours: s.opening_hours,
    isWebOrderingOpen: s.is_web_ordering_open,
    taxEnabled: s.tax_enabled,
    taxPercentage: s.tax_percentage,
    digitalExpiryMinutes: s.digital_expiry_minutes,
    cashExpiryMinutes: s.cash_expiry_minutes,
    receiptFooterNote: s.receipt_footer_note,
    updatedAt: s.updated_at ? s.updated_at.toISOString() : null,
  };
}

export async function getPublicStoreSettings(): Promise<PublicStoreSettings> {
  const { data } = await getAdminSettings();
  return {
    isWebOrderingOpen: data.isWebOrderingOpen,
    taxEnabled: data.taxEnabled,
    taxPercentage: data.taxPercentage,
    digitalExpiryMinutes: data.digitalExpiryMinutes,
    cashExpiryMinutes: data.cashExpiryMinutes,
  };
}

/* ----------------------------------------------------------------------------
 * Kategori & Menu
 * ------------------------------------------------------------------------- */

export async function listAdminCategories() {
  return readWithFallback<AdminCategory[]>(
    "categories",
    async () => {
      const rows = await prisma.category.findMany({
        orderBy: [{ deleted_at: "asc" }, { sort_order: "asc" }],
        include: { _count: { select: { products: { where: { deleted_at: null } } } } },
      });
      return rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        sortOrder: c.sort_order,
        isActive: c.is_active,
        deletedAt: c.deleted_at ? c.deleted_at.toISOString() : null,
        productCount: c._count.products,
      }));
    },
    () => {
      const store = getMemoryStore();
      const products = [...store.products.values()];
      return [...store.categories.values()]
        .sort((a, b) => Number(!!a.deleted_at) - Number(!!b.deleted_at) || a.sort_order - b.sort_order)
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          sortOrder: c.sort_order,
          isActive: c.is_active,
          deletedAt: c.deleted_at ? c.deleted_at.toISOString() : null,
          productCount: products.filter((p) => p.category_id === c.id && !p.deleted_at).length,
        }));
    },
  );
}

function memorySoldMap(): Map<string, number> {
  const sold = new Map<string, number>();
  for (const o of getMemoryStore().demoOrders) {
    if (o.status === "CANCELLED") continue;
    for (const it of o.items) sold.set(it.product_id, (sold.get(it.product_id) ?? 0) + it.quantity);
  }
  return sold;
}

export async function listAdminProducts() {
  return readWithFallback<AdminProduct[]>(
    "products",
    async () => {
      const [rows, sold] = await Promise.all([
        prisma.product.findMany({
          orderBy: [{ deleted_at: "asc" }, { sort_order: "asc" }, { name: "asc" }],
          include: {
            category: true,
            stock: true,
            option_groups: {
              orderBy: { sort_order: "asc" },
              include: { option_items: { orderBy: { sort_order: "asc" } } },
            },
          },
        }),
        prisma.orderItem.groupBy({
          by: ["product_id"],
          _sum: { quantity: true },
          where: { order: { status: { not: "CANCELLED" } } },
        }),
      ]);
      const soldMap = new Map(sold.map((s) => [s.product_id, s._sum.quantity ?? 0]));
      return rows.map((p) => ({
        id: p.id,
        categoryId: p.category_id,
        categoryName: p.category.name,
        name: p.name,
        description: p.description,
        basePrice: Number(p.base_price),
        imageUrl: p.image_url,
        isAvailable: p.is_available,
        sortOrder: p.sort_order,
        deletedAt: p.deleted_at ? p.deleted_at.toISOString() : null,
        availableQty: p.stock?.available_qty ?? 0,
        reservedQty: p.stock?.reserved_qty ?? 0,
        minThreshold: p.stock?.min_threshold ?? 5,
        soldQty: soldMap.get(p.id) ?? 0,
        optionGroups: p.option_groups.map((g) => ({
          id: g.id,
          name: g.name,
          isRequired: g.is_required,
          isMulti: g.max_select > 1,
          items: g.option_items.map((i) => ({
            id: i.id,
            name: i.name,
            priceAdjustment: Number(i.price_adjustment),
            isAvailable: i.is_available,
          })),
        })),
      }));
    },
    () => {
      const store = getMemoryStore();
      const sold = memorySoldMap();
      return [...store.products.values()]
        .sort((a, b) => Number(!!a.deleted_at) - Number(!!b.deleted_at) || a.sort_order - b.sort_order)
        .map((p) => {
          const stock = store.stocks.get(p.id);
          return {
            id: p.id,
            categoryId: p.category_id,
            categoryName: store.categories.get(p.category_id)?.name ?? "-",
            name: p.name,
            description: p.description,
            basePrice: p.base_price,
            imageUrl: p.image_url,
            isAvailable: p.is_available,
            sortOrder: p.sort_order,
            deletedAt: p.deleted_at ? p.deleted_at.toISOString() : null,
            availableQty: stock?.available_qty ?? 0,
            reservedQty: stock?.reserved_qty ?? 0,
            minThreshold: stock?.min_threshold ?? 5,
            soldQty: sold.get(p.id) ?? 0,
            optionGroups: p.option_groups.map((g) => ({
              id: g.id,
              name: g.name,
              isRequired: g.is_required,
              isMulti: g.max_select > 1,
              items: g.items.map((i) => ({
                id: i.id,
                name: i.name,
                priceAdjustment: i.price_adjustment,
                isAvailable: i.is_available,
              })),
            })),
          };
        });
    },
  );
}

/* ----------------------------------------------------------------------------
 * Mutasi Stok
 * ------------------------------------------------------------------------- */

export async function listStockMovements(limit = 50) {
  return readWithFallback<AdminStockMovement[]>(
    "stock-movements",
    async () => {
      const rows = await prisma.stockMovement.findMany({
        take: limit,
        orderBy: { created_at: "desc" },
        include: { product: { select: { name: true } }, actor: { select: { name: true } } },
      });
      return rows.map((m) => ({
        id: m.id,
        productId: m.product_id,
        productName: m.product.name,
        actorName: m.actor?.name ?? null,
        movementType: m.movement_type as StockMovementType,
        qtyChange: m.qty_change,
        availableBefore: m.available_before,
        availableAfter: m.available_after,
        reservedBefore: m.reserved_before,
        reservedAfter: m.reserved_after,
        reason: m.reason,
        createdAt: m.created_at.toISOString(),
      }));
    },
    () => {
      const store = getMemoryStore();
      return store.movements.slice(0, limit).map((m) => ({
        id: m.id,
        productId: m.product_id,
        productName: store.products.get(m.product_id)?.name ?? m.product_id,
        actorName: m.actor_name,
        movementType: m.movement_type,
        qtyChange: m.qty_change,
        availableBefore: m.available_before,
        availableAfter: m.available_after,
        reservedBefore: m.reserved_before,
        reservedAfter: m.reserved_after,
        reason: m.reason,
        createdAt: m.created_at.toISOString(),
      }));
    },
  );
}

/* ----------------------------------------------------------------------------
 * Audit Log
 * ------------------------------------------------------------------------- */

export interface AuditFilter {
  entity?: string;
  q?: string;
  limit?: number;
}

export async function listAuditLogs(filter: AuditFilter = {}) {
  const limit = Math.min(filter.limit ?? 100, 300);
  const q = filter.q?.trim().toLowerCase() ?? "";
  const matches = (log: AdminAuditLog) =>
    !q ||
    log.action.toLowerCase().includes(q) ||
    log.entityId.toLowerCase().includes(q) ||
    (log.actorName ?? "").toLowerCase().includes(q) ||
    (log.reason ?? "").toLowerCase().includes(q);

  return readWithFallback<AdminAuditLog[]>(
    "audit-logs",
    async () => {
      const rows = await prisma.auditLog.findMany({
        where: filter.entity ? { entity_name: filter.entity } : undefined,
        take: q ? 300 : limit,
        orderBy: { created_at: "desc" },
        include: { actor: { select: { name: true } } },
      });
      return rows
        .map((l) => ({
          id: l.id,
          actorId: l.actor_id,
          actorName: l.actor?.name ?? null,
          actorRole: l.actor_role,
          entityName: l.entity_name,
          entityId: l.entity_id,
          action: l.action,
          oldData: l.old_data,
          newData: l.new_data,
          reason: l.reason,
          createdAt: l.created_at.toISOString(),
        }))
        .filter(matches)
        .slice(0, limit);
    },
    () =>
      getMemoryStore()
        .auditLogs.filter((l) => !filter.entity || l.entity_name === filter.entity)
        .map((l) => ({
          id: l.id,
          actorId: l.actor_id,
          actorName: l.actor_name,
          actorRole: l.actor_role,
          entityName: l.entity_name,
          entityId: l.entity_id,
          action: l.action,
          oldData: l.old_data,
          newData: l.new_data,
          reason: l.reason,
          createdAt: l.created_at.toISOString(),
        }))
        .filter(matches)
        .slice(0, limit),
  );
}

/* ----------------------------------------------------------------------------
 * Dashboard Ringkasan & Analitik
 * ------------------------------------------------------------------------- */

interface NormalizedOrder {
  status: string;
  createdAt: Date;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  items: { key: string; name: string; quantity: number; subtotal: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatDay(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function resolvePeriod(period: PeriodKey, fromStr?: string, toStr?: string) {
  const now = new Date();
  let from: Date;
  let to = endOfDay(now);
  let label: string;

  switch (period) {
    case "7d":
      from = startOfDay(new Date(now.getTime() - 6 * DAY_MS));
      label = "7 Hari Terakhir";
      break;
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      label = `Bulan Ini (${MONTHS[now.getMonth()]} ${now.getFullYear()})`;
      break;
    case "custom": {
      const f = fromStr ? new Date(`${fromStr}T00:00:00`) : null;
      const t = toStr ? new Date(`${toStr}T00:00:00`) : null;
      if (f && !Number.isNaN(f.getTime()) && t && !Number.isNaN(t.getTime()) && f <= t) {
        from = startOfDay(f);
        to = endOfDay(t);
        if (to.getTime() - from.getTime() > 92 * DAY_MS) {
          from = startOfDay(new Date(to.getTime() - 91 * DAY_MS));
        }
        label = `${formatDay(from)} – ${formatDay(to)} ${to.getFullYear()}`;
      } else {
        from = startOfDay(new Date(now.getTime() - 6 * DAY_MS));
        label = "7 Hari Terakhir (rentang kustom tidak valid)";
      }
      break;
    }
    case "today":
    default:
      from = startOfDay(now);
      label = "Hari Ini";
      break;
  }
  return { from, to, label };
}

function summarize(
  orders: NormalizedOrder[],
  period: PeriodKey,
  range: { from: Date; to: Date; label: string },
  stock: { low: number; out: number },
): DashboardSummary {
  const inRange = orders.filter((o) => o.createdAt >= range.from && o.createdAt <= range.to);
  const isSuccess = (o: NormalizedOrder) => o.status !== "CANCELLED" && o.paymentStatus === "PAID";
  const successful = inRange.filter(isSuccess);
  const refundedOrders = inRange.filter((o) => o.paymentStatus === "REFUNDED");
  const cancelled = inRange.filter((o) => o.status === "CANCELLED");

  const grossSales = successful.reduce((s, o) => s + o.total, 0);
  const taxCollected = successful.reduce((s, o) => s + o.tax, 0);
  const refunds = refundedOrders.reduce((s, o) => s + o.total, 0);
  // Net Sales = penjualan kotor dikurangi pajak (PB1) — refund sudah tidak dihitung sebagai PAID
  const netSales = grossSales - taxCollected;

  // Grafik penjualan: per jam bila rentang 1 hari, selain itu per hari
  const spanDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS));
  const chart: SalesPoint[] = [];
  if (spanDays <= 1) {
    for (let h = 0; h < 24; h++) {
      const bucket = successful.filter((o) => o.createdAt.getHours() === h);
      chart.push({
        label: `${String(h).padStart(2, "0")}.00`,
        netSales: bucket.reduce((s, o) => s + o.total - o.tax, 0),
        orders: bucket.length,
      });
    }
  } else {
    for (let d = new Date(range.from); d <= range.to; d = new Date(d.getTime() + DAY_MS)) {
      const dayStart = startOfDay(d).getTime();
      const dayEnd = dayStart + DAY_MS;
      const bucket = successful.filter((o) => o.createdAt.getTime() >= dayStart && o.createdAt.getTime() < dayEnd);
      chart.push({
        label: formatDay(d),
        netSales: bucket.reduce((s, o) => s + o.total - o.tax, 0),
        orders: bucket.length,
      });
    }
  }

  const productMap = new Map<string, TopProduct>();
  for (const o of successful) {
    for (const it of o.items) {
      const cur = productMap.get(it.key) ?? { productId: it.key, name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += it.subtotal;
      productMap.set(it.key, cur);
    }
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 5);

  const cashOrders = successful.filter((o) => o.paymentMethod === "CASH");
  const digitalOrders = successful.filter((o) => o.paymentMethod !== "CASH");

  return {
    period,
    rangeLabel: range.label,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    grossSales,
    taxCollected,
    refunds,
    netSales,
    successfulOrders: successful.length,
    totalOrders: inRange.length,
    cancelledOrders: cancelled.length,
    cancellationRate: inRange.length ? (cancelled.length / inRange.length) * 100 : 0,
    averageOrderValue: successful.length ? Math.round(netSales / successful.length) : 0,
    chart,
    topProducts,
    paymentSplit: {
      cash: cashOrders.length,
      digital: digitalOrders.length,
      cashAmount: cashOrders.reduce((s, o) => s + o.total, 0),
      digitalAmount: digitalOrders.reduce((s, o) => s + o.total, 0),
    },
    lowStockCount: stock.low,
    outOfStockCount: stock.out,
  };
}

export async function getDashboardSummary(period: PeriodKey, fromStr?: string, toStr?: string) {
  await connection();
  const range = resolvePeriod(period, fromStr, toStr);
  const { data: products } = await listAdminProducts();
  const active = products.filter((p) => !p.deletedAt);
  const stock = {
    low: active.filter((p) => getStockStatus(p.availableQty, p.minThreshold) === "LOW_STOCK").length,
    out: active.filter((p) => getStockStatus(p.availableQty, p.minThreshold) === "OUT_OF_STOCK").length,
  };

  return readWithFallback<DashboardSummary>(
    "dashboard",
    async () => {
      const rows = await prisma.order.findMany({
        where: { created_at: { gte: range.from, lte: range.to } },
        select: {
          status: true,
          created_at: true,
          subtotal: true,
          tax_amount: true,
          total_amount: true,
          payment: { select: { method: true, status: true } },
          items: { select: { product_id: true, product_name_snapshot: true, quantity: true, subtotal: true } },
        },
      });
      const orders: NormalizedOrder[] = rows.map((o) => ({
        status: o.status,
        createdAt: o.created_at,
        subtotal: Number(o.subtotal),
        tax: Number(o.tax_amount),
        total: Number(o.total_amount),
        paymentMethod: o.payment?.method ?? "CASH",
        paymentStatus: o.payment?.status ?? "UNPAID",
        items: o.items.map((it) => ({
          key: it.product_id,
          name: it.product_name_snapshot,
          quantity: it.quantity,
          subtotal: Number(it.subtotal),
        })),
      }));
      return summarize(orders, period, range, stock);
    },
    () => {
      const demo: NormalizedOrder[] = getMemoryStore().demoOrders.map((o) => ({
        status: o.status,
        createdAt: o.created_at,
        subtotal: o.subtotal,
        tax: o.tax_amount,
        total: o.total_amount,
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        items: o.items.map((it) => ({ key: it.product_id, name: it.name, quantity: it.quantity, subtotal: it.subtotal })),
      }));
      const live: NormalizedOrder[] = [...memoryOrders.values()].map((o) => ({
        status: o.status,
        createdAt: new Date(o.created_at),
        subtotal: Number(o.subtotal),
        tax: Number(o.tax_amount),
        total: Number(o.total_amount),
        paymentMethod: o.payment?.method ?? "CASH",
        paymentStatus: o.payment?.status ?? "UNPAID",
        items: o.items.map((it) => ({
          key: it.product_name_snapshot,
          name: it.product_name_snapshot,
          quantity: it.quantity,
          subtotal: Number(it.subtotal),
        })),
      }));
      return summarize([...demo, ...live], period, range, stock);
    },
  );
}

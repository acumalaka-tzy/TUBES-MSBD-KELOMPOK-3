import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { memoryOrders } from "@/actions/helpers";
import { memoryUsers } from "@/lib/auth/mock-users";
import { getStockStatus } from "@/lib/menu-data";
import { invalidateDatabaseCheck, isDatabaseReady, withTimeout } from "./db";
import { getMemoryStore } from "./memory-store";
import type {
  AdminAuditLog,
  AdminCategory,
  AdminProduct,
  AdminSettings,
  AdminStaffUser,
  AdminStockMovement,
  AdminTable,
  DashboardSummary,
  DataSource,
  DetailedSalesReport,
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

/* ----------------------------------------------------------------------------
 * Manajemen Meja & QR Code
 * ------------------------------------------------------------------------- */

export async function listAdminTables() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return readWithFallback<AdminTable[]>(
    "tables",
    async () => {
      const rows = await prisma.table.findMany({
        orderBy: { table_number: "asc" },
        include: {
          qr_codes: {
            where: { is_active: true },
            orderBy: { created_at: "desc" },
            take: 1,
          },
          _count: { select: { orders: true } },
        },
      });

      return rows.map((r) => {
        const activeQr = r.qr_codes[0];
        const token = activeQr?.token ?? null;
        const qrUrl = token
          ? `${appUrl}/menu?table=${encodeURIComponent(r.table_number)}&token=${encodeURIComponent(token)}`
          : null;

        return {
          id: r.id,
          tableNumber: r.table_number,
          name: r.name,
          capacity: r.capacity,
          status: r.status as AdminTable["status"],
          isActive: r.is_active,
          activeQrToken: token,
          activeQrUrl: qrUrl,
          qrGeneratedAt: activeQr?.created_at ? activeQr.created_at.toISOString() : null,
          ordersCount: r._count.orders,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        };
      });
    },
    () => {
      const mem = getMemoryStore();
      return [...mem.tables.values()]
        .sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true }))
        .map((r) => {
          const qrs = mem.tableQrCodes.get(r.id) ?? [];
          const activeQr = qrs.find((q) => q.is_active);
          const token = activeQr?.token ?? null;
          const qrUrl = token
            ? `${appUrl}/menu?table=${encodeURIComponent(r.table_number)}&token=${encodeURIComponent(token)}`
            : null;

          return {
            id: r.id,
            tableNumber: r.table_number,
            name: r.name,
            capacity: r.capacity,
            status: r.status,
            isActive: r.is_active,
            activeQrToken: token,
            activeQrUrl: qrUrl,
            qrGeneratedAt: activeQr?.created_at ? activeQr.created_at.toISOString() : null,
            ordersCount: 0,
            createdAt: r.created_at.toISOString(),
            updatedAt: r.updated_at.toISOString(),
          };
        });
    },
  );
}

/* ----------------------------------------------------------------------------
 * Manajemen Staf / Kasir
 * ------------------------------------------------------------------------- */

export async function listAdminStaff() {
  return readWithFallback<AdminStaffUser[]>(
    "staff",
    async () => {
      const rows = await prisma.user.findMany({
        where: { role: "CASHIER" },
        orderBy: { created_at: "asc" },
      });

      return rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.is_active,
        createdAt: u.created_at.toISOString(),
        updatedAt: u.updated_at.toISOString(),
      }));
    },
    () => {
      return [...memoryUsers.values()]
        .filter((u) => u.role === "CASHIER")
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          isActive: u.is_active,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
    },
  );
}

/* ----------------------------------------------------------------------------
 * Laporan Penjualan & Ekspor Detail
 * ------------------------------------------------------------------------- */

interface RawReportOrder {
  id: string;
  orderNumber: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  serviceType: string;
  tableNumber: string | null;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  items: {
    productId: string;
    name: string;
    categoryName: string;
    quantity: number;
    subtotal: number;
  }[];
}

function buildDetailedReport(
  orders: RawReportOrder[],
  period: PeriodKey,
  range: { from: Date; to: Date; label: string },
): DetailedSalesReport {
  const inRange = orders.filter((o) => o.createdAt >= range.from && o.createdAt <= range.to);

  let grossSales = 0;
  let taxCollected = 0;
  let netSales = 0;
  let refunds = 0;
  let totalOrders = inRange.length;
  let completedOrders = 0;
  let cancelledOrders = 0;
  let totalItemsSold = 0;

  const paymentMap = new Map<string, { count: number; amount: number }>();
  const serviceMap = new Map<string, { count: number; amount: number }>();
  const dailyMap = new Map<string, { count: number; gross: number; tax: number; net: number }>();
  const productMap = new Map<
    string,
    { name: string; category: string; qty: number; revenue: number }
  >();

  for (const o of inRange) {
    const isCompleted = o.status !== "CANCELLED" && o.paymentStatus === "PAID";
    const isRefunded = o.paymentStatus === "REFUNDED";

    if (isCompleted) {
      completedOrders++;
      grossSales += o.totalAmount;
      taxCollected += o.taxAmount;
      netSales += o.subtotal;

      // Payment Breakdown
      const pKey = o.paymentMethod || "CASH";
      const pCur = paymentMap.get(pKey) ?? { count: 0, amount: 0 };
      pCur.count++;
      pCur.amount += o.totalAmount;
      paymentMap.set(pKey, pCur);

      // Service Breakdown
      const sKey = o.serviceType || "DINE_IN";
      const sCur = serviceMap.get(sKey) ?? { count: 0, amount: 0 };
      sCur.count++;
      sCur.amount += o.totalAmount;
      serviceMap.set(sKey, sCur);

      // Daily Breakdown
      const dateKey = o.createdAt.toISOString().slice(0, 10);
      const dCur = dailyMap.get(dateKey) ?? { count: 0, gross: 0, tax: 0, net: 0 };
      dCur.count++;
      dCur.gross += o.totalAmount;
      dCur.tax += o.taxAmount;
      dCur.net += o.subtotal;
      dailyMap.set(dateKey, dCur);

      // Product Performance
      for (const it of o.items) {
        totalItemsSold += it.quantity;
        const prodCur = productMap.get(it.productId) ?? {
          name: it.name,
          category: it.categoryName,
          qty: 0,
          revenue: 0,
        };
        prodCur.qty += it.quantity;
        prodCur.revenue += it.subtotal;
        productMap.set(it.productId, prodCur);
      }
    } else if (o.status === "CANCELLED") {
      cancelledOrders++;
    } else if (isRefunded) {
      refunds += o.totalAmount;
    }
  }

  const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
  const averageOrderValue = completedOrders > 0 ? Math.round(grossSales / completedOrders) : 0;

  // Format Daily Sales sorted by date asc
  const dailySales = [...dailyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, val]) => ({
      date,
      ordersCount: val.count,
      grossAmount: val.gross,
      taxAmount: val.tax,
      netAmount: val.net,
    }));

  // Format Payment Breakdown
  const paymentBreakdown = [...paymentMap.entries()].map(([method, val]) => ({
    method,
    count: val.count,
    amount: val.amount,
    percentage: grossSales > 0 ? Math.round((val.amount / grossSales) * 100) : 0,
  }));

  // Format Service Breakdown
  const serviceBreakdown = [...serviceMap.entries()].map(([serviceType, val]) => ({
    serviceType,
    count: val.count,
    amount: val.amount,
    percentage: grossSales > 0 ? Math.round((val.amount / grossSales) * 100) : 0,
  }));

  // Format Product Performance sorted by revenue desc
  const productPerformance = [...productMap.entries()]
    .map(([productId, val]) => ({
      productId,
      productName: val.name,
      categoryName: val.category,
      quantitySold: val.qty,
      totalRevenue: val.revenue,
      sharePercentage: netSales > 0 ? Math.round((val.revenue / netSales) * 100) : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Recent transactions sorted by date desc
  const recentTransactions = inRange
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50)
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toISOString(),
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      serviceType: o.serviceType,
      tableNumber: o.tableNumber,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      orderStatus: o.status,
      subtotal: o.subtotal,
      taxAmount: o.taxAmount,
      totalAmount: o.totalAmount,
    }));

  return {
    period,
    rangeLabel: range.label,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    generatedAt: new Date().toISOString(),
    summary: {
      grossSales,
      taxCollected,
      refunds,
      netSales,
      totalOrders,
      completedOrders,
      cancelledOrders,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      averageOrderValue,
      totalItemsSold,
    },
    dailySales,
    paymentBreakdown,
    serviceBreakdown,
    productPerformance,
    recentTransactions,
  };
}

export async function getDetailedSalesReport(
  period: PeriodKey = "7d",
  fromStr?: string,
  toStr?: string,
) {
  const range = resolvePeriod(period, fromStr, toStr);

  return readWithFallback<DetailedSalesReport>(
    "detailed-sales-report",
    async () => {
      const dbOrders = await prisma.order.findMany({
        where: {
          created_at: {
            gte: range.from,
            lte: range.to,
          },
        },
        orderBy: { created_at: "desc" },
        include: {
          payment: true,
          table: { select: { table_number: true } },
          items: {
            include: {
              product: { select: { category: { select: { name: true } } } },
            },
          },
        },
      });

      return buildDetailedReport(
        dbOrders.map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          createdAt: o.created_at,
          customerName: o.customer_name,
          customerPhone: o.customer_phone,
          serviceType: o.service_type,
          tableNumber: o.table?.table_number ?? null,
          status: o.status,
          subtotal: Number(o.subtotal),
          taxAmount: Number(o.tax_amount),
          totalAmount: Number(o.total_amount),
          paymentMethod: o.payment?.method ?? "CASH",
          paymentStatus: o.payment?.status ?? "UNPAID",
          items: o.items.map((it) => ({
            productId: it.product_id,
            name: it.product_name_snapshot,
            categoryName: it.product?.category?.name ?? "Lainnya",
            quantity: it.quantity,
            subtotal: Number(it.subtotal),
          })),
        })),
        period,
        range,
      );
    },
    () => {
      const demoOrders = getMemoryStore().demoOrders;
      const memOrders = [...memoryOrders.values()];

      const combined = [
        ...demoOrders.map((o) => ({
          id: o.id,
          orderNumber: `ORD-DEMO-${o.id}`,
          createdAt: o.created_at,
          customerName: "Pelanggan Demo",
          customerPhone: "08123456789",
          serviceType: "DINE_IN",
          tableNumber: "01",
          status: o.status,
          subtotal: o.subtotal,
          taxAmount: o.tax_amount,
          totalAmount: o.total_amount,
          paymentMethod: o.payment_method,
          paymentStatus: o.payment_status,
          items: o.items.map((it) => ({
            productId: it.product_id,
            name: it.name,
            categoryName: "Katalog",
            quantity: it.quantity,
            subtotal: it.subtotal,
          })),
        })),
        ...memOrders.map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          createdAt: new Date(o.created_at),
          customerName: o.customer_name,
          customerPhone: o.customer_phone,
          serviceType: o.service_type,
          tableNumber: o.table?.table_number ?? null,
          status: o.status,
          subtotal: Number(o.subtotal),
          taxAmount: Number(o.tax_amount),
          totalAmount: Number(o.total_amount),
          paymentMethod: o.payment?.method ?? "CASH",
          paymentStatus: o.payment?.status ?? "UNPAID",
          items: o.items.map((it) => ({
            productId: it.id,
            name: it.product_name_snapshot,
            categoryName: "Menu",
            quantity: it.quantity,
            subtotal: Number(it.subtotal),
          })),
        })),
      ].filter((o) => o.createdAt >= range.from && o.createdAt <= range.to);

      return buildDetailedReport(combined, period, range);
    },
  );
}


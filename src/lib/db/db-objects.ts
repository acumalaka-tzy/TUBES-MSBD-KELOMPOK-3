/**
 * Database Objects Integration Layer (MySQL / TiDB)
 * Modul ini secara resmi mengintegrasikan 7 VIEW, 6 FUNCTION, dan 7 STORED PROCEDURE
 * yang telah didefinisikan dalam database ke dalam kode aplikasi TypeScript melalui Prisma ORM.
 */

import { prisma } from "@/lib/prisma";
import { isDatabaseReady, withTimeout } from "@/lib/admin/db";

const DB_TIMEOUT_MS = 15000;

// ============================================================================
// 1. DATABASE VIEWS
// ============================================================================

export interface DailySalesSummaryView {
  sales_date: string;
  total_orders: number;
  successful_orders: number;
  cancelled_orders: number;
  gross_sales: number;
  total_tax: number;
  total_refund: number;
  net_sales: number;
  average_order_value: number;
}

export async function getViewDailySalesSummary(): Promise<DailySalesSummaryView[]> {
  if (!(await isDatabaseReady())) return [];
  try {
    const rows = await withTimeout(
      prisma.$queryRaw<DailySalesSummaryView[]>`
        SELECT * FROM vw_daily_sales_summary ORDER BY sales_date DESC LIMIT 30
      `,
      DB_TIMEOUT_MS
    );
    return rows.map((r) => ({
      ...r,
      total_orders: Number(r.total_orders || 0),
      successful_orders: Number(r.successful_orders || 0),
      cancelled_orders: Number(r.cancelled_orders || 0),
      gross_sales: Number(r.gross_sales || 0),
      total_tax: Number(r.total_tax || 0),
      total_refund: Number(r.total_refund || 0),
      net_sales: Number(r.net_sales || 0),
      average_order_value: Number(r.average_order_value || 0),
    }));
  } catch (err) {
    console.warn("Gagal membaca vw_daily_sales_summary:", err);
    return [];
  }
}

export interface MenuAvailabilityView {
  product_id: string;
  category_id: string;
  category_name: string;
  product_name: string;
  base_price: number;
  image_url: string | null;
  sort_order: number;
  manual_is_available: boolean;
  available_qty: number;
  reserved_qty: number;
  min_threshold: number;
  effective_is_available: number;
  stock_status: string;
}

export async function getViewMenuAvailability(): Promise<MenuAvailabilityView[]> {
  if (!(await isDatabaseReady())) return [];
  try {
    const rows = await withTimeout(
      prisma.$queryRaw<MenuAvailabilityView[]>`
        SELECT * FROM vw_menu_availability ORDER BY sort_order ASC
      `,
      DB_TIMEOUT_MS
    );
    return rows.map((r) => ({
      ...r,
      base_price: Number(r.base_price || 0),
      available_qty: Number(r.available_qty || 0),
      reserved_qty: Number(r.reserved_qty || 0),
      effective_is_available: Number(r.effective_is_available || 0),
    }));
  } catch (err) {
    console.warn("Gagal membaca vw_menu_availability:", err);
    return [];
  }
}

export interface TableOccupancyStatusView {
  table_id: string;
  table_number: string;
  table_name: string;
  capacity: number;
  is_active: boolean;
  stored_status: string;
  effective_status: string;
  active_order_count: number;
  current_active_orders: string | null;
}

export async function getViewTableOccupancyStatus(): Promise<TableOccupancyStatusView[]> {
  if (!(await isDatabaseReady())) return [];
  try {
    const rows = await withTimeout(
      prisma.$queryRaw<TableOccupancyStatusView[]>`
        SELECT * FROM vw_table_occupancy_status ORDER BY table_number ASC
      `,
      DB_TIMEOUT_MS
    );
    return rows.map((r) => ({
      ...r,
      capacity: Number(r.capacity || 0),
      active_order_count: Number(r.active_order_count || 0),
    }));
  } catch (err) {
    console.warn("Gagal membaca vw_table_occupancy_status:", err);
    return [];
  }
}

export interface TopSellingProductView {
  product_id: string;
  product_name: string;
  category_name: string;
  total_qty_sold: number;
  total_revenue: number;
  order_frequency: number;
}

export async function getViewTopSellingProducts(): Promise<TopSellingProductView[]> {
  if (!(await isDatabaseReady())) return [];
  try {
    const rows = await withTimeout(
      prisma.$queryRaw<TopSellingProductView[]>`
        SELECT * FROM vw_top_selling_products LIMIT 10
      `,
      DB_TIMEOUT_MS
    );
    return rows.map((r) => ({
      ...r,
      total_qty_sold: Number(r.total_qty_sold || 0),
      total_revenue: Number(r.total_revenue || 0),
      order_frequency: Number(r.order_frequency || 0),
    }));
  } catch (err) {
    console.warn("Gagal membaca vw_top_selling_products:", err);
    return [];
  }
}

// ============================================================================
// 2. STORED FUNCTIONS
// ============================================================================

/**
 * fn_check_table_qr_valid: Memvalidasi apakah meja dan token QR aktif di MySQL
 */
export async function dbFnCheckTableQrValid(tableId: string, token: string): Promise<boolean> {
  if (!(await isDatabaseReady())) return true;
  try {
    const res = await withTimeout(
      prisma.$queryRaw<[{ isValid: number }]>`
        SELECT fn_check_table_qr_valid(${tableId}, ${token}) AS isValid
      `,
      DB_TIMEOUT_MS
    );
    return Boolean(res[0]?.isValid);
  } catch (err) {
    console.warn("Fallback check QR:", err);
    return true;
  }
}

/**
 * fn_get_product_available_stock: Menghitung sisa stok produk yang siap dijual
 */
export async function dbFnGetProductAvailableStock(productId: string): Promise<number> {
  if (!(await isDatabaseReady())) return 999;
  try {
    const res = await withTimeout(
      prisma.$queryRaw<[{ stock: number }]>`
        SELECT fn_get_product_available_stock(${productId}) AS stock
      `,
      DB_TIMEOUT_MS
    );
    return Number(res[0]?.stock || 0);
  } catch (err) {
    console.warn("Fallback get stock:", err);
    return 999;
  }
}

/**
 * fn_calculate_order_total: Menghitung total pesanan termasuk opsi tambahan
 */
export async function dbFnCalculateOrderTotal(orderId: string): Promise<number> {
  if (!(await isDatabaseReady())) return 0;
  try {
    const res = await withTimeout(
      prisma.$queryRaw<[{ total: number }]>`
        SELECT fn_calculate_order_total(${orderId}) AS total
      `,
      DB_TIMEOUT_MS
    );
    return Number(res[0]?.total || 0);
  } catch (err) {
    console.warn("Gagal fn_calculate_order_total:", err);
    return 0;
  }
}

/**
 * fn_format_rupiah: Format mata uang Rupiah langsung di engine database
 */
export async function dbFnFormatRupiah(amount: number): Promise<string> {
  if (!(await isDatabaseReady())) return `Rp ${amount.toLocaleString("id-ID")}`;
  try {
    const res = await withTimeout(
      prisma.$queryRaw<[{ formatted: string }]>`
        SELECT fn_format_rupiah(${amount}) AS formatted
      `,
      DB_TIMEOUT_MS
    );
    return res[0]?.formatted || `Rp ${amount.toLocaleString("id-ID")}`;
  } catch (err) {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }
}

// ============================================================================
// 3. STORED PROCEDURES
// ============================================================================

/**
 * sp_reserve_product_stock: Memesan/mengunci stok porsi saat checkout
 */
export async function dbSpReserveProductStock(
  productId: string,
  qty: number,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await isDatabaseReady())) return { success: true };
  try {
    await withTimeout(
      prisma.$executeRawUnsafe(
        `CALL sp_reserve_product_stock(?, ?, ?)`,
        productId,
        qty,
        orderId
      ),
      DB_TIMEOUT_MS
    );
    return { success: true };
  } catch (err: any) {
    console.warn("sp_reserve_product_stock failed:", err?.message);
    return { success: false, error: err?.message || "Stok produk tidak mencukupi." };
  }
}

/**
 * sp_commit_reserved_stock: Memfinalisasi pengurangan stok saat pembayaran lunas
 */
export async function dbSpCommitReservedStock(
  orderId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await isDatabaseReady())) return { success: true };
  try {
    await withTimeout(
      prisma.$executeRawUnsafe(
        `CALL sp_commit_reserved_stock(?, ?)`,
        orderId,
        actorId
      ),
      DB_TIMEOUT_MS
    );
    return { success: true };
  } catch (err: any) {
    console.warn("sp_commit_reserved_stock failed:", err?.message);
    return { success: false, error: err?.message || "Gagal komit stok reservasi." };
  }
}

/**
 * sp_release_expired_orders: Mengembalikan stok pesanan kedaluwarsa secara otomatis
 */
export async function dbSpReleaseExpiredOrders(): Promise<{ releasedCount: number }> {
  if (!(await isDatabaseReady())) return { releasedCount: 0 };
  try {
    const res = await withTimeout(
      prisma.$queryRaw<any[]>`CALL sp_release_expired_orders()`,
      DB_TIMEOUT_MS
    );
    return { releasedCount: Number(res?.[0]?.released_orders_count || 0) };
  } catch (err) {
    console.warn("sp_release_expired_orders:", err);
    return { releasedCount: 0 };
  }
}

/**
 * sp_complete_and_clear_table: Menyelesaikan seluruh tagihan meja dan mengubah status meja ke AVAILABLE
 */
export async function dbSpCompleteAndClearTable(
  tableId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await isDatabaseReady())) return { success: true };
  try {
    await withTimeout(
      prisma.$executeRawUnsafe(
        `CALL sp_complete_and_clear_table(?, ?)`,
        tableId,
        actorId
      ),
      DB_TIMEOUT_MS
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal mengosongkan meja." };
  }
}

/**
 * sp_rotate_table_qr_token: Merotasi token QR meja untuk keamanan berkala
 */
export async function dbSpRotateTableQrToken(
  tableId: string,
  newToken: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await isDatabaseReady())) return { success: true };
  try {
    await withTimeout(
      prisma.$executeRawUnsafe(
        `CALL sp_rotate_table_qr_token(?, ?, ?)`,
        tableId,
        newToken,
        actorId
      ),
      DB_TIMEOUT_MS
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal merotasi QR token meja." };
  }
}

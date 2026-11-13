/**
 * Tipe data (DTO) Dashboard Admin — seluruhnya serializable agar aman
 * dikirim dari Server Component ke Client Component.
 */

export type DataSource = "database" | "memory";

export type PeriodKey = "today" | "7d" | "month" | "custom";

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  deletedAt: string | null;
  productCount: number;
}

export interface AdminOptionItem {
  id: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
}

export interface AdminOptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  isMulti: boolean;
  items: AdminOptionItem[];
}

export interface AdminProduct {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  deletedAt: string | null;
  availableQty: number;
  reservedQty: number;
  minThreshold: number;
  soldQty: number;
  optionGroups: AdminOptionGroup[];
}

export interface AdminStockMovement {
  id: string;
  productId: string;
  productName: string;
  actorName: string | null;
  movementType: StockMovementType;
  qtyChange: number;
  availableBefore: number;
  availableAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  reason: string | null;
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  entityName: string;
  entityId: string;
  action: string;
  oldData: unknown;
  newData: unknown;
  reason: string | null;
  createdAt: string;
}

export interface AdminSettings {
  restaurantName: string;
  address: string;
  phoneWhatsapp: string;
  openingHours: string;
  isWebOrderingOpen: boolean;
  taxEnabled: boolean;
  taxPercentage: number;
  digitalExpiryMinutes: number;
  cashExpiryMinutes: number;
  receiptFooterNote: string;
  updatedAt: string | null;
}

/** Pengaturan yang dibutuhkan alur pemesanan pelanggan (checkout & cart). */
export interface PublicStoreSettings {
  isWebOrderingOpen: boolean;
  taxEnabled: boolean;
  taxPercentage: number;
  digitalExpiryMinutes: number;
  cashExpiryMinutes: number;
}

export interface SalesPoint {
  label: string;
  netSales: number;
  orders: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
}

export interface DashboardSummary {
  period: PeriodKey;
  rangeLabel: string;
  from: string;
  to: string;
  grossSales: number;
  taxCollected: number;
  refunds: number;
  netSales: number;
  successfulOrders: number;
  totalOrders: number;
  cancelledOrders: number;
  cancellationRate: number;
  averageOrderValue: number;
  chart: SalesPoint[];
  topProducts: TopProduct[];
  paymentSplit: { cash: number; digital: number; cashAmount: number; digitalAmount: number };
  lowStockCount: number;
  outOfStockCount: number;
}

export const STOCK_MOVEMENT_TYPES = [
  "INITIAL_STOCK",
  "RESTOCK",
  "DAMAGED_EXPIRED",
  "OPNAME_CORRECTION",
  "RESERVE",
  "RELEASE_RESERVE",
  "SALE_DEDUCTION",
  "REFUND_RESTORE",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/** Alasan penyesuaian stok manual sesuai PRD 7.3 (wajib dipilih). */
export const ADJUSTMENT_REASONS = {
  RESTOCK: { label: "Stok baru / tambahan produksi", direction: "in" },
  DAMAGED_EXPIRED: { label: "Rusak / basi", direction: "out" },
  OPNAME_CORRECTION: { label: "Koreksi stok opname", direction: "set" },
} as const;

export type AdjustmentReason = keyof typeof ADJUSTMENT_REASONS;

export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  INITIAL_STOCK: "Stok Harian",
  RESTOCK: "Stok Baru",
  DAMAGED_EXPIRED: "Rusak/Basi",
  OPNAME_CORRECTION: "Koreksi Opname",
  RESERVE: "Reservasi Pesanan",
  RELEASE_RESERVE: "Lepas Reservasi",
  SALE_DEDUCTION: "Terjual",
  REFUND_RESTORE: "Pengembalian Refund",
};

export interface ActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

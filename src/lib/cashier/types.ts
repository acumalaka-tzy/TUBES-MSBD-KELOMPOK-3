import type {
  AdminCategory,
  AdminProduct,
  AdminSettings,
  DataSource,
} from "@/lib/admin/types";

export type CashierTabKey = "queue" | "pos" | "tables" | "history" | "stock";

export type QueueFilterKey = "action" | "preparing" | "ready" | "done" | "all";

export interface CashierOrderItemOption {
  groupName: string;
  optionName: string;
  priceAdjustment: number;
}

export interface CashierOrderItem {
  id: string;
  productId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  itemNotes: string | null;
  options: CashierOrderItemOption[];
}

export interface CashierOrderPayment {
  id: string;
  method: "CASH" | "QRIS" | "VIRTUAL_ACCOUNT" | string;
  status: "UNPAID" | "PAID" | "FAILED" | "REFUNDED" | string;
  amountDue: number;
  amountPaid: number;
  changeAmount: number;
  paidAt: string | null;
  cashierName?: string | null;
}

export interface CashierOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  trackingToken: string | null;
  source: "WEB" | "POS" | string;
  serviceType: "DINE_IN" | "TAKEAWAY" | string;
  status: "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED" | string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
  tableNumber: string | null;
  tableName: string | null;
  items: CashierOrderItem[];
  payment: CashierOrderPayment;
}

export interface CashierTableInfo {
  id: string;
  tableNumber: string;
  name: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "INACTIVE";
  isActive: boolean;
  activeOrders: {
    orderNumber: string;
    customerName: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
  }[];
}

export interface CashierMetrics {
  todayRevenue: number;
  todayOrdersCount: number;
  paidOrdersCount: number;
  needActionCount: number;
  preparingCount: number;
  readyCount: number;
  unpaidCashCount: number;
  occupiedTablesCount: number;
  totalActiveTablesCount: number;
}

export interface CashierDashboardPayload {
  dataSource: DataSource;
  settings: AdminSettings;
  metrics: CashierMetrics;
  orders: CashierOrder[];
  tables: CashierTableInfo[];
  categories: AdminCategory[];
  products: AdminProduct[];
}

export interface PosCreateOrderInput {
  customerName: string;
  customerPhone?: string;
  serviceType: "DINE_IN" | "TAKEAWAY";
  tableNumber?: string;
  paymentMethod: "CASH" | "QRIS" | "VIRTUAL_ACCOUNT";
  amountPaid?: number;
  notes?: string;
  items: {
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    itemNotes?: string;
    options: {
      groupName: string;
      optionName: string;
      priceAdjustment: number;
    }[];
  }[];
}

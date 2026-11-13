export interface CheckoutOrderItemOption {
  groupName: string;
  optionName: string;
  priceAdjustment: number;
}

export interface CheckoutOrderItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  itemNotes?: string;
  options: CheckoutOrderItemOption[];
}

export interface CheckoutInput {
  customerName: string;
  customerPhone: string;
  serviceType: "DINE_IN" | "TAKEAWAY";
  tableNumber?: string;
  paymentMethod: "CASH" | "QRIS" | "VIRTUAL_ACCOUNT";
  notes?: string;
  items: CheckoutOrderItem[];
}

export interface AvailableProduct {
  id: string;
  name: string;
  category: string;
  base_price: number;
  description: string | null;
  available_qty: number;
  option_groups: {
    id: string;
    name: string;
    is_required: boolean;
    items: {
      id: string;
      name: string;
      price_adjustment: number;
    }[];
  }[];
}

export type AvailableProductSummary = AvailableProduct;

export interface TableItem {
  id: string;
  table_number: string;
  name: string;
  status: string;
}

export interface OrderOptionSnapshot {
  option_group_name_snapshot: string;
  option_name_snapshot: string;
  price_adjustment_snapshot: number;
}

export interface OrderItemSnapshot {
  id: string;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  subtotal: number;
  item_notes: string | null;
  options: OrderOptionSnapshot[];
}

export interface OrderDetailData {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  tracking_token: string | null;
  source: string;
  service_type: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  expires_at: Date | string | null;
  created_at: Date | string;
  table: { table_number: string; name: string } | null;
  items: OrderItemSnapshot[];
  payment: {
    id: string;
    method: string;
    status: string;
    amount_due: number;
    amount_paid: number;
    change_amount?: number;
    paid_at: Date | string | null;
  } | null;
}

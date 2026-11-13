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

export interface TableItem {
  id: string;
  table_number: string;
  name: string;
  status: string;
}

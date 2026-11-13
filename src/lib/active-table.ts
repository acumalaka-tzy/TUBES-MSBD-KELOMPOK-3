"use client";

import { useSyncExternalStore } from "react";

const TABLE_KEY = "warkop_agam_table";
const TABLE_EVENT = "warkop-table-change";

const ORDERS_KEY = "warkop_agam_recent_orders";
const ORDERS_EVENT = "warkop-orders-change";

export interface RecentOrderSummary {
  orderNumber: string;
  trackingToken?: string | null;
  totalAmount: number;
  serviceType: "DINE_IN" | "TAKEAWAY";
  tableNumber?: string;
  createdAt: string;
}

/** Simpan meja aktif (dari QR / ?table=) agar tetap terbawa antar halaman. */
export function setActiveTable(table: string | null) {
  try {
    if (table) {
      if (sessionStorage.getItem(TABLE_KEY) !== table) {
        sessionStorage.setItem(TABLE_KEY, table);
      }
    } else {
      sessionStorage.removeItem(TABLE_KEY);
    }
    window.dispatchEvent(new Event(TABLE_EVENT));
  } catch {
    // sessionStorage tidak tersedia
  }
}

function subscribeTable(onChange: () => void) {
  window.addEventListener(TABLE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(TABLE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Nomor meja aktif, atau null jika pelanggan tidak sedang Dine In via QR. */
export function useActiveTable(): string | null {
  return useSyncExternalStore(
    subscribeTable,
    () => {
      try {
        return sessionStorage.getItem(TABLE_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

/** Simpan riwayat nomor pesanan guest di browser agar mudah dilacak kembali (PRD 5.1). */
export function saveRecentOrder(order: RecentOrderSummary) {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    const list: RecentOrderSummary[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((o) => o.orderNumber !== order.orderNumber);
    const next = [order, ...filtered].slice(0, 5);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(ORDERS_EVENT));
  } catch {
    // localStorage tidak tersedia
  }
}

export function getRecentOrders(): RecentOrderSummary[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? (JSON.parse(raw) as RecentOrderSummary[]) : [];
  } catch {
    return [];
  }
}

export function clearRecentOrders() {
  try {
    localStorage.removeItem(ORDERS_KEY);
    window.dispatchEvent(new Event(ORDERS_EVENT));
  } catch {
    // localStorage tidak tersedia
  }
}

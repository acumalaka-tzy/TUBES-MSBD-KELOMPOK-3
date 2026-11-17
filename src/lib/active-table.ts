"use client";

import { useSyncExternalStore } from "react";

const TABLE_KEY = "warkop_agam_table";
const TABLE_EVENT = "warkop-table-change";

const LEGACY_ORDERS_KEY = "warkop_agam_recent_orders";
const ORDERS_KEY_PREFIX = "warkop_agam_recent_orders:";
const ORDERS_EVENT = "warkop-orders-change";

export type OrderHistoryScope = "guest" | `user:${string}`;

export function getOrderHistoryScope(userId?: string | null): OrderHistoryScope {
  return userId ? `user:${userId}` : "guest";
}

function getScopedOrdersKey(scope: OrderHistoryScope): string {
  return `${ORDERS_KEY_PREFIX}${scope}`;
}

function purgeLegacyOrdersKey() {
  try {
    if (localStorage.getItem(LEGACY_ORDERS_KEY) !== null) {
      localStorage.removeItem(LEGACY_ORDERS_KEY);
    }
  } catch {
    // localStorage tidak tersedia
  }
}

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

/** Simpan riwayat nomor pesanan sesuai pemilik sesi (guest atau user:<id>) di browser. */
export function saveRecentOrder(
  order: RecentOrderSummary,
  scope: OrderHistoryScope = "guest",
) {
  try {
    purgeLegacyOrdersKey();
    const key = getScopedOrdersKey(scope);
    const raw = localStorage.getItem(key);
    const list: RecentOrderSummary[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((o) => o.orderNumber !== order.orderNumber);
    const next = [order, ...filtered].slice(0, 10);
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(ORDERS_EVENT));
  } catch {
    // localStorage tidak tersedia
  }
}

export function getRecentOrders(scope: OrderHistoryScope = "guest"): RecentOrderSummary[] {
  try {
    purgeLegacyOrdersKey();
    const raw = localStorage.getItem(getScopedOrdersKey(scope));
    return raw ? (JSON.parse(raw) as RecentOrderSummary[]) : [];
  } catch {
    return [];
  }
}

const EMPTY_RECENT_ORDERS: RecentOrderSummary[] = [];
const scopedCache = new Map<string, { raw: string | null; parsed: RecentOrderSummary[] }>();

function subscribeRecentOrders(onChange: () => void) {
  window.addEventListener(ORDERS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ORDERS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getRecentOrdersSnapshot(scope: OrderHistoryScope | null): RecentOrderSummary[] {
  if (!scope) return EMPTY_RECENT_ORDERS;
  try {
    purgeLegacyOrdersKey();
    const key = getScopedOrdersKey(scope);
    const raw = localStorage.getItem(key);
    const cached = scopedCache.get(key);
    if (!cached || cached.raw !== raw) {
      const parsed = raw ? (JSON.parse(raw) as RecentOrderSummary[]) : EMPTY_RECENT_ORDERS;
      scopedCache.set(key, { raw, parsed });
      return parsed;
    }
    return cached.parsed;
  } catch {
    return EMPTY_RECENT_ORDERS;
  }
}

/** Berlangganan riwayat pesanan lokal perangkat sesuai scope akun/guest secara reaktif (SSR-safe). */
export function useRecentOrders(scope: OrderHistoryScope | null): RecentOrderSummary[] {
  return useSyncExternalStore(
    subscribeRecentOrders,
    () => getRecentOrdersSnapshot(scope),
    () => EMPTY_RECENT_ORDERS,
  );
}

export function removeRecentOrders(
  orderNumbers: string[],
  scope: OrderHistoryScope = "guest",
) {
  if (orderNumbers.length === 0) return;
  try {
    const key = getScopedOrdersKey(scope);
    const removeSet = new Set(orderNumbers);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const list = JSON.parse(raw) as RecentOrderSummary[];
    const next = list.filter((o) => !removeSet.has(o.orderNumber));
    if (next.length !== list.length) {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(ORDERS_EVENT));
    }
  } catch {
    // localStorage tidak tersedia
  }
}

export function clearRecentOrders(scope?: OrderHistoryScope) {
  try {
    purgeLegacyOrdersKey();
    if (scope) {
      localStorage.removeItem(getScopedOrdersKey(scope));
    } else {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(ORDERS_KEY_PREFIX)) {
          localStorage.removeItem(k);
        }
      }
    }
    window.dispatchEvent(new Event(ORDERS_EVENT));
  } catch {
    // localStorage tidak tersedia
  }
}

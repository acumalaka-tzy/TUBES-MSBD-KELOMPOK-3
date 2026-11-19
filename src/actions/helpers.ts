import { revalidatePath } from "next/cache";
import type { OrderDetailData } from "./types";

export function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Dipanggil di luar request context Next.js (misal script test)
  }
}

const globalForOrders = globalThis as unknown as {
  __warkopMemoryOrders?: Map<string, OrderDetailData>;
};

// Fallback in-memory storage jika MySQL belum terkoneksi (mulai kosong tanpa data order/omzet palsu)
export const memoryOrders: Map<string, OrderDetailData> =
  globalForOrders.__warkopMemoryOrders ??
  (globalForOrders.__warkopMemoryOrders = new Map<string, OrderDetailData>());

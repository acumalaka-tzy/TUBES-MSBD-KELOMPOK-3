import { revalidatePath } from "next/cache";

export function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Dipanggil di luar request context Next.js (misal script test)
  }
}

// Fallback in-memory storage jika MySQL belum terkoneksi saat pengujian mandiri
export const memoryOrders = new Map<string, any>();

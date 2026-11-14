import { prisma } from "@/lib/prisma";

const CHECK_TTL_MS = 15_000;
const CHECK_TIMEOUT_MS = 2500;

const globalForDb = globalThis as unknown as {
  __warkopDbCheck?: { ready: boolean; checkedAt: number; error?: string };
};

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Database timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Mengecek apakah database MySQL tersambung dan skema tabel sudah dibuat.
 * Hasil di-cache 15 detik agar tidak membebani setiap request.
 */
export async function isDatabaseReady(): Promise<boolean> {
  const cached = globalForDb.__warkopDbCheck;
  if (cached && Date.now() - cached.checkedAt < CHECK_TTL_MS) {
    return cached.ready;
  }
  try {
    await withTimeout(prisma.category.count(), CHECK_TIMEOUT_MS);
    globalForDb.__warkopDbCheck = { ready: true, checkedAt: Date.now() };
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n").pop() : String(err);
    globalForDb.__warkopDbCheck = { ready: false, checkedAt: Date.now(), error: message };
    return false;
  }
}

/** Paksa pengecekan ulang pada request berikutnya (mis. setelah error query). */
export function invalidateDatabaseCheck() {
  globalForDb.__warkopDbCheck = undefined;
}

export function errorMessage(err: unknown, fallback = "Terjadi kesalahan pada server."): string {
  if (err instanceof Error) {
    const line = err.message.split("\n").filter(Boolean).pop();
    return line || fallback;
  }
  return fallback;
}

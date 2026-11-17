import { prisma } from "@/lib/prisma";

const CHECK_SUCCESS_TTL_MS = 30_000;
const CHECK_FAILURE_TTL_MS = 1_500;
const CHECK_TIMEOUT_MS = 8000;

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
 * Hasil sukses di-cache 30 detik agar tidak membebani setiap request.
 * Jika gagal, di-cache hanya 1.5 detik agar segera mencoba ulang (resilien terhadap cold-start).
 */
export async function isDatabaseReady(): Promise<boolean> {
  const cached = globalForDb.__warkopDbCheck;
  const ttl = cached?.ready ? CHECK_SUCCESS_TTL_MS : CHECK_FAILURE_TTL_MS;
  if (cached && Date.now() - cached.checkedAt < ttl) {
    return cached.ready;
  }

  const ping = async () => {
    // findFirst jauh lebih cepat daripada count() karena tidak melakukan agregasi seluruh row
    await prisma.category.findFirst({ select: { id: true } });
  };

  try {
    await withTimeout(ping(), CHECK_TIMEOUT_MS);
    globalForDb.__warkopDbCheck = { ready: true, checkedAt: Date.now() };
    return true;
  } catch (err) {
    // Retry sekali sebelum menyimpulkan database down (mengatasi handshake latency cloud)
    try {
      await withTimeout(ping(), CHECK_TIMEOUT_MS);
      globalForDb.__warkopDbCheck = { ready: true, checkedAt: Date.now() };
      return true;
    } catch (err2) {
      const message = err2 instanceof Error ? err2.message.split("\n").pop() : String(err2);
      globalForDb.__warkopDbCheck = { ready: false, checkedAt: Date.now(), error: message };
      return false;
    }
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

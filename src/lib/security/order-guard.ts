import { headers } from "next/headers";

export interface CachedOrderResult {
  orderNumber: string;
  trackingToken: string;
  tableSessionToken?: string | null;
  createdAt: number;
}

interface OrderGuardState {
  rateBuckets: Map<string, number[]>;
  apiBuckets: Map<string, number[]>;
  cooldowns: Map<string, number>;
  idempotencyCache: Map<string, CachedOrderResult>;
  inFlightKeys: Set<string>;
}

const globalForGuard = globalThis as unknown as {
  __warkopOrderGuardState?: OrderGuardState;
};

function getGuardState(): OrderGuardState {
  if (!globalForGuard.__warkopOrderGuardState) {
    globalForGuard.__warkopOrderGuardState = {
      rateBuckets: new Map<string, number[]>(),
      apiBuckets: new Map<string, number[]>(),
      cooldowns: new Map<string, number>(),
      idempotencyCache: new Map<string, CachedOrderResult>(),
      inFlightKeys: new Set<string>(),
    };
  }
  return globalForGuard.__warkopOrderGuardState;
}

export const ORDER_GUARD_CONFIG = {
  cooldownMs: 15_000, // Minimal jeda 15 detik antar pembuatan pesanan baru
  shortWindowMs: 5 * 60_000, // Jendela 5 menit
  shortWindowMax: 4, // Maksimal 4 pesanan per 5 menit per identitas
  hourlyWindowMs: 60 * 60_000, // Jendela 1 jam
  hourlyWindowMax: 15, // Maksimal 15 pesanan per jam per identitas
  maxPendingUnpaidOrders: 2, // Maksimal 2 pesanan PENDING belum bayar bersamaan
  idempotencyTtlMs: 30 * 60_000, // Cache idempotency key selama 30 menit
  apiWindowMs: 60_000, // Jendela 1 menit untuk API pembayaran
  apiMaxRequests: 25, // Maksimal 25 request/menit per IP
};

/**
 * Ekstrak alamat IP client dari header Next.js secara aman.
 * Mengembalikan fallback saat dipanggil di luar konteks HTTP request (mis. script uji).
 */
export async function getClientIpSafe(): Promise<string> {
  try {
    const hdrs = await headers();
    const xff = hdrs.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const realIp = hdrs.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  } catch {
    // Di luar Next.js request context
  }
  return "127.0.0.1";
}

export function normalizeActorPhone(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function buildActorKeys(params: {
  ip?: string;
  userId?: string | null;
  customerPhone?: string | null;
}): string[] {
  const keys: string[] = [];
  if (params.userId) keys.push(`usr:${params.userId}`);
  const normPhone = normalizeActorPhone(params.customerPhone);
  if (normPhone) keys.push(`phn:${normPhone}`);
  if (params.ip) keys.push(`ip:${params.ip}`);
  if (keys.length === 0) keys.push("anon:default");
  return keys;
}

function pruneTimestamps(list: number[], cutoff: number): number[] {
  return list.filter((ts) => ts >= cutoff);
}

/**
 * Cek hasil idempotency yang sudah tersimpan di cache memori.
 */
export function getCachedIdempotencyOrder(
  idempotencyKey?: string | null
): CachedOrderResult | null {
  const key = idempotencyKey?.trim();
  if (!key) return null;
  const state = getGuardState();
  const cached = state.idempotencyCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > ORDER_GUARD_CONFIG.idempotencyTtlMs) {
    state.idempotencyCache.delete(key);
    return null;
  }
  return cached;
}

export function saveCachedIdempotencyOrder(
  idempotencyKey: string | null | undefined,
  result: Omit<CachedOrderResult, "createdAt">
): void {
  const key = idempotencyKey?.trim();
  if (!key) return;
  const state = getGuardState();
  state.idempotencyCache.set(key, {
    ...result,
    createdAt: Date.now(),
  });
}

export function tryAcquireInFlightOrderKey(idempotencyKey?: string | null): boolean {
  const key = idempotencyKey?.trim();
  if (!key) return true;
  const state = getGuardState();
  if (state.inFlightKeys.has(key)) {
    return false;
  }
  state.inFlightKeys.add(key);
  return true;
}

export function releaseInFlightOrderKey(idempotencyKey?: string | null): void {
  const key = idempotencyKey?.trim();
  if (!key) return;
  getGuardState().inFlightKeys.delete(key);
}

/**
 * Validasi cooldown & sliding-window rate limit sebelum membuat pesanan baru.
 */
export function checkOrderSpamAndRateLimit(params: {
  ip?: string;
  userId?: string | null;
  customerPhone?: string | null;
  nowMs?: number;
}): { ok: true } | { ok: false; error: string; retryAfterSeconds: number } {
  const now = params.nowMs ?? Date.now();
  const state = getGuardState();
  const keys = buildActorKeys(params);

  // 1. Cek cooldown antar order per user/phone (dan IP jika guest)
  for (const key of keys) {
    // Prioritaskan user & phone agar jaringan WiFi bersama tidak memblokir cooldown pelanggan berbeda jika sudah login/berbeda HP
    if (key.startsWith("ip:") && (params.userId || params.customerPhone)) {
      continue;
    }
    const lastOrderAt = state.cooldowns.get(key);
    if (lastOrderAt && now - lastOrderAt < ORDER_GUARD_CONFIG.cooldownMs) {
      const remainingSec = Math.max(
        1,
        Math.ceil((ORDER_GUARD_CONFIG.cooldownMs - (now - lastOrderAt)) / 1000)
      );
      return {
        ok: false,
        error: `Terlalu cepat membuat pesanan beruntun. Mohon tunggu ${remainingSec} detik sebelum memesan lagi.`,
        retryAfterSeconds: remainingSec,
      };
    }
  }

  // 2. Cek sliding-window rate limiting (5 menit & 1 jam)
  const shortCutoff = now - ORDER_GUARD_CONFIG.shortWindowMs;
  const hourCutoff = now - ORDER_GUARD_CONFIG.hourlyWindowMs;

  for (const key of keys) {
    const raw = state.rateBuckets.get(key) ?? [];
    const withinHour = pruneTimestamps(raw, hourCutoff);
    state.rateBuckets.set(key, withinHour);

    const withinShort = withinHour.filter((ts) => ts >= shortCutoff);
    // IP shared WiFi diberi kelonggaran 2x lipat jika berbeda nomor HP
    const shortLimit = key.startsWith("ip:")
      ? ORDER_GUARD_CONFIG.shortWindowMax * 2
      : ORDER_GUARD_CONFIG.shortWindowMax;
    const hourLimit = key.startsWith("ip:")
      ? ORDER_GUARD_CONFIG.hourlyWindowMax * 2
      : ORDER_GUARD_CONFIG.hourlyWindowMax;

    if (withinShort.length >= shortLimit) {
      const oldestShort = withinShort[0] ?? now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldestShort + ORDER_GUARD_CONFIG.shortWindowMs - now) / 1000)
      );
      return {
        ok: false,
        error: `Batas permintaan pemesanan sementara tercapai. Silakan coba lagi dalam ${Math.ceil(retryAfterSeconds / 60)} menit.`,
        retryAfterSeconds,
      };
    }

    if (withinHour.length >= hourLimit) {
      const oldestHour = withinHour[0] ?? now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldestHour + ORDER_GUARD_CONFIG.hourlyWindowMs - now) / 1000)
      );
      return {
        ok: false,
        error: "Aktivitas pemesanan Anda melebihi batas per jam. Silakan hubungi kasir jika membutuhkan bantuan.",
        retryAfterSeconds,
      };
    }
  }

  return { ok: true };
}

/**
 * Catat pembuatan order berhasil ke window rate limiter dan cooldown.
 */
export function recordSuccessfulOrderAttempt(params: {
  ip?: string;
  userId?: string | null;
  customerPhone?: string | null;
  nowMs?: number;
}): void {
  const now = params.nowMs ?? Date.now();
  const state = getGuardState();
  const keys = buildActorKeys(params);
  const hourCutoff = now - ORDER_GUARD_CONFIG.hourlyWindowMs;

  for (const key of keys) {
    if (!key.startsWith("ip:") || (!params.userId && !params.customerPhone)) {
      state.cooldowns.set(key, now);
    }
    const existing = pruneTimestamps(state.rateBuckets.get(key) ?? [], hourCutoff);
    existing.push(now);
    state.rateBuckets.set(key, existing);
  }
}

/**
 * Rate limiter ringan untuk endpoint API pembayaran (Snap & status polling).
 */
export function checkApiRateLimit(
  bucketKey: string,
  maxRequests = ORDER_GUARD_CONFIG.apiMaxRequests,
  windowMs = ORDER_GUARD_CONFIG.apiWindowMs
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const state = getGuardState();
  const timestamps = pruneTimestamps(state.apiBuckets.get(bucketKey) ?? [], cutoff);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    state.apiBuckets.set(bucketKey, timestamps);
    return { ok: false, retryAfterSeconds };
  }

  timestamps.push(now);
  state.apiBuckets.set(bucketKey, timestamps);
  return { ok: true };
}

/**
 * Reset state guard — khusus digunakan pada automated unit/integration test.
 */
export function resetOrderGuardForTest(): void {
  const state = getGuardState();
  state.rateBuckets.clear();
  state.apiBuckets.clear();
  state.cooldowns.clear();
  state.idempotencyCache.clear();
  state.inFlightKeys.clear();
}

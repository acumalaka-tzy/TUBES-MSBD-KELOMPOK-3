import { prisma } from "@/lib/prisma";
import { getMemoryStore, memoryId, type MemTable, type MemTableSession } from "@/lib/admin/memory-store";
import { memoryOrders } from "@/actions/helpers";
import { normalizeActorPhone } from "@/lib/security/order-guard";
import type { OrderDetailData } from "@/actions/types";

export const ACTIVE_BILL_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"] as const;

export function normalizeTableNumber(raw: string): {
  raw: string;
  clean: string;
  padded: string;
} {
  const trimmed = String(raw).trim();
  const clean = trimmed.replace(/^0+/, "") || trimmed;
  const padded = clean.padStart(2, "0");
  return { raw: trimmed, clean, padded };
}

export function generateTableSessionToken(tableNumber: string): string {
  const clean = normalizeTableNumber(tableNumber).clean;
  return `tsess_${clean}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isSessionOwnedBy(params: {
  ownerUserId?: string | null;
  ownerPhone?: string | null;
  sessionToken?: string | null;
  requesterUserId?: string | null;
  requesterPhone?: string | null;
  requesterSessionToken?: string | null;
}): boolean {
  if (
    params.requesterSessionToken &&
    params.sessionToken &&
    params.requesterSessionToken === params.sessionToken
  ) {
    return true;
  }
  if (
    params.requesterUserId &&
    params.ownerUserId &&
    params.requesterUserId === params.ownerUserId
  ) {
    return true;
  }
  const reqPhone = normalizeActorPhone(params.requesterPhone);
  const ownPhone = normalizeActorPhone(params.ownerPhone);
  if (reqPhone && ownPhone && reqPhone === ownPhone) {
    return true;
  }
  return false;
}

export function findMemoryTableByNumber(tableNumber: string): MemTable | null {
  const store = getMemoryStore();
  const { raw, clean, padded } = normalizeTableNumber(tableNumber);
  for (const t of store.tables.values()) {
    if (
      t.table_number === raw ||
      t.table_number === clean ||
      t.table_number === padded
    ) {
      return t;
    }
  }
  return null;
}

export function getActiveMemoryTableSession(tableId: string): MemTableSession | null {
  const store = getMemoryStore();
  for (const s of store.tableSessions.values()) {
    if (s.table_id === tableId && s.status === "ACTIVE") {
      return s;
    }
  }
  return null;
}

/**
 * Cari atau buat sesi kunjungan aktif untuk sebuah meja di in-memory store.
 * Jika meja sudah memiliki sesi ACTIVE, hanya diizinkan bila milik pengguna/sesi yang sama
 * atau dibuat oleh kasir (allowCashierAttach).
 */
export function resolveOrCreateMemoryTableSession(params: {
  table: MemTable;
  userId?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  tableSessionToken?: string | null;
  allowCashierAttach?: boolean;
}):
  | { ok: true; session: MemTableSession; isNew: boolean }
  | { ok: false; error: string } {
  const store = getMemoryStore();
  const cleanNum = normalizeTableNumber(params.table.table_number).clean;
  const existingSession = getActiveMemoryTableSession(params.table.id);

  if (existingSession) {
    if (params.allowCashierAttach) {
      return { ok: true, session: existingSession, isNew: false };
    }
    const owned = isSessionOwnedBy({
      ownerUserId: existingSession.owner_user_id,
      ownerPhone: existingSession.owner_phone,
      sessionToken: existingSession.session_token,
      requesterUserId: params.userId,
      requesterPhone: params.customerPhone,
      requesterSessionToken: params.tableSessionToken,
    });
    if (!owned) {
      return {
        ok: false,
        error: `Meja ${cleanNum} sedang memiliki sesi kunjungan aktif oleh pelanggan lain. Silakan pilih meja kosong atau hubungi kasir.`,
      };
    }
    // Lengkapi identitas pemilik sesi bila sebelumnya masih kosong
    if (!existingSession.owner_user_id && params.userId) {
      existingSession.owner_user_id = params.userId;
    }
    if (!existingSession.owner_phone && params.customerPhone) {
      existingSession.owner_phone = normalizeActorPhone(params.customerPhone);
    }
    return { ok: true, session: existingSession, isNew: false };
  }

  // Belum ada TableSession eksplisit — cek apakah ada order DINE_IN aktif legacy tanpa session_id
  const legacyActiveOrders = Array.from(memoryOrders.values()).filter(
    (o) =>
      o.service_type === "DINE_IN" &&
      o.table?.table_number === params.table.table_number &&
      ACTIVE_BILL_STATUSES.includes(o.status as (typeof ACTIVE_BILL_STATUSES)[number])
  );

  if (params.table.status === "OCCUPIED" && legacyActiveOrders.length === 0 && !params.allowCashierAttach) {
    // Meja berstatus OCCUPIED tanpa order/session aktif (kemungkinan di-set manual kasir)
    return {
      ok: false,
      error: `Meja ${cleanNum} saat ini sedang terisi/ditempati pelanggan lain. Silakan pilih meja yang kosong.`,
    };
  }

  if (legacyActiveOrders.length > 0 && !params.allowCashierAttach) {
    const sameLegacyOwner = legacyActiveOrders.some((o) =>
      isSessionOwnedBy({
        ownerUserId: o.user_id,
        ownerPhone: o.customer_phone,
        requesterUserId: params.userId,
        requesterPhone: params.customerPhone,
      })
    );
    if (!sameLegacyOwner) {
      return {
        ok: false,
        error: `Meja ${cleanNum} saat ini sedang terisi/ditempati pelanggan lain. Silakan pilih meja yang kosong.`,
      };
    }
  }

  const now = new Date();
  const newSession: MemTableSession = {
    id: memoryId("tsess"),
    table_id: params.table.id,
    table_number: params.table.table_number,
    session_token: params.tableSessionToken || generateTableSessionToken(params.table.table_number),
    owner_user_id: params.userId ?? null,
    owner_phone: normalizeActorPhone(params.customerPhone) || null,
    owner_name: params.customerName?.trim() || null,
    status: "ACTIVE",
    opened_at: now,
    closed_at: null,
  };
  store.tableSessions.set(newSession.id, newSession);

  // Kaitkan legacy order di meja ini ke sesi baru bila ada
  for (const lo of legacyActiveOrders) {
    if (!lo.table_session_id) {
      lo.table_session_id = newSession.id;
    }
  }

  params.table.status = "OCCUPIED";
  params.table.updated_at = now;

  return { ok: true, session: newSession, isNew: true };
}

export function getMemorySessionOrders(sessionId: string): OrderDetailData[] {
  return Array.from(memoryOrders.values()).filter((o) => o.table_session_id === sessionId);
}

/**
 * Sinkronkan status sesi meja memori setelah salah satu bill dibatalkan/kedaluwarsa atau selesai.
 * - Jika seluruh bill di sesi tersebut dibatalkan (tidak ada bill aktif atau selesai-berbayar): tutup sesi & kosongkan meja.
 * - Jika `forceCloseIfAllFinished` true (misal aksi "Kosongkan Meja" / selesai terakhir): tutup sesi hanya jika
 *   seluruh bill dalam sesi sudah COMPLETED (PAID) atau CANCELLED.
 */
export function syncMemoryTableSessionLifecycle(
  tableId: string,
  options?: { closeIfAllCompleted?: boolean }
): { closed: boolean; blockerMessage?: string } {
  const store = getMemoryStore();
  const table = store.tables.get(tableId);
  const activeSession = getActiveMemoryTableSession(tableId);
  if (!table || !activeSession) {
    return { closed: false };
  }

  const sessionOrders = getMemorySessionOrders(activeSession.id);
  const activeKitchenOrders = sessionOrders.filter((o) =>
    ACTIVE_BILL_STATUSES.includes(o.status as (typeof ACTIVE_BILL_STATUSES)[number])
  );
  const unpaidNonCancelledOrders = sessionOrders.filter(
    (o) => o.status !== "CANCELLED" && o.payment?.status !== "PAID"
  );
  const nonCancelledOrders = sessionOrders.filter((o) => o.status !== "CANCELLED");

  // 1. Jika semua bill batal/expired (0 non-cancelled bills tersisa), sesi otomatis ditutup agar meja kembali tersedia
  if (nonCancelledOrders.length === 0) {
    activeSession.status = "CLOSED";
    activeSession.closed_at = new Date();
    table.status = "AVAILABLE";
    table.updated_at = new Date();
    return { closed: true };
  }

  // 2. Jika diminta menutup sesi (misal saat kasir menyelesaikan bill / mengosongkan meja)
  if (options?.closeIfAllCompleted) {
    if (activeKitchenOrders.length > 0 || unpaidNonCancelledOrders.length > 0) {
      return {
        closed: false,
        blockerMessage: `Masih ada ${Math.max(activeKitchenOrders.length, unpaidNonCancelledOrders.length)} bill aktif/belum lunas dalam sesi meja ini.`,
      };
    }
    activeSession.status = "CLOSED";
    activeSession.closed_at = new Date();
    table.status = "AVAILABLE";
    table.updated_at = new Date();
    return { closed: true };
  }

  return { closed: false };
}

/**
 * Helper database Prisma: periksa & sinkronkan TableSession saat order dibatalkan/kedaluwarsa atau diselesaikan.
 */
export async function syncDbTableSessionLifecycle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txOrPrisma: any,
  tableId: string | null | undefined,
  options?: { closeIfAllCompleted?: boolean }
): Promise<{ closed: boolean; blockerMessage?: string }> {
  if (!tableId) return { closed: false };

  const activeSession = await txOrPrisma.tableSession.findFirst({
    where: { table_id: tableId, status: "ACTIVE" },
    orderBy: { opened_at: "desc" },
  });

  if (!activeSession) {
    // Fallback untuk order tanpa table_session_id
    if (options?.closeIfAllCompleted) {
      const remaining = await txOrPrisma.order.count({
        where: {
          table_id: tableId,
          service_type: "DINE_IN",
          status: { in: [...ACTIVE_BILL_STATUSES] },
        },
      });
      if (remaining === 0) {
        await txOrPrisma.table.update({
          where: { id: tableId },
          data: { status: "AVAILABLE" },
        });
        return { closed: true };
      }
    }
    return { closed: false };
  }

  const sessionOrders = await txOrPrisma.order.findMany({
    where: { table_session_id: activeSession.id },
    include: { payment: { select: { status: true } } },
  });

  const activeKitchenCount = sessionOrders.filter((o: { status: string }) =>
    ACTIVE_BILL_STATUSES.includes(o.status as (typeof ACTIVE_BILL_STATUSES)[number])
  ).length;
  const unpaidCount = sessionOrders.filter(
    (o: { status: string; payment?: { status: string } | null }) =>
      o.status !== "CANCELLED" && o.payment?.status !== "PAID"
  ).length;
  const nonCancelledCount = sessionOrders.filter(
    (o: { status: string }) => o.status !== "CANCELLED"
  ).length;

  if (nonCancelledCount === 0) {
    await txOrPrisma.tableSession.update({
      where: { id: activeSession.id },
      data: { status: "CLOSED", closed_at: new Date() },
    });
    await txOrPrisma.table.update({
      where: { id: tableId },
      data: { status: "AVAILABLE" },
    });
    return { closed: true };
  }

  if (options?.closeIfAllCompleted) {
    if (activeKitchenCount > 0 || unpaidCount > 0) {
      return {
        closed: false,
        blockerMessage: `Masih ada ${Math.max(activeKitchenCount, unpaidCount)} bill aktif/belum lunas dalam sesi meja ini.`,
      };
    }
    await txOrPrisma.tableSession.update({
      where: { id: activeSession.id },
      data: { status: "CLOSED", closed_at: new Date() },
    });
    await txOrPrisma.table.update({
      where: { id: tableId },
      data: { status: "AVAILABLE" },
    });
    return { closed: true };
  }

  return { closed: false };
}

/**
 * Sinkronkan kepemilikan meja publik untuk daftar meja checkout (tanpa membocorkan PII pelanggan).
 */
export async function checkTableSessionOwnershipForClient(params: {
  tableId: string;
  tableNumber: string;
  userId?: string | null;
  customerPhone?: string | null;
  tableSessionToken?: string | null;
}): Promise<{ activeSessionId: string | null; activeSessionOwned: boolean }> {
  // Cek memori dulu / fallback
  const memSess = getActiveMemoryTableSession(params.tableId);
  if (memSess) {
    return {
      activeSessionId: memSess.id,
      activeSessionOwned: isSessionOwnedBy({
        ownerUserId: memSess.owner_user_id,
        ownerPhone: memSess.owner_phone,
        sessionToken: memSess.session_token,
        requesterUserId: params.userId,
        requesterPhone: params.customerPhone,
        requesterSessionToken: params.tableSessionToken,
      }),
    };
  }

  try {
    const dbSess = await prisma.tableSession.findFirst({
      where: { table_id: params.tableId, status: "ACTIVE" },
      orderBy: { opened_at: "desc" },
    });
    if (dbSess) {
      return {
        activeSessionId: dbSess.id,
        activeSessionOwned: isSessionOwnedBy({
          ownerUserId: dbSess.owner_user_id,
          ownerPhone: dbSess.owner_phone,
          sessionToken: dbSess.session_token,
          requesterUserId: params.userId,
          requesterPhone: params.customerPhone,
          requesterSessionToken: params.tableSessionToken,
        }),
      };
    }
  } catch {
    // DB tidak tersambung
  }

  return { activeSessionId: null, activeSessionOwned: false };
}

"use server";

import { prisma } from "@/lib/prisma";
import { withDistributedTransaction } from "@/lib/db/distributed";
import { CheckoutInput, OrderDetailData } from "./types";
import { memoryOrders, safeRevalidate } from "./helpers";
import { getSession } from "@/lib/auth/session";
import { getPublicStoreSettings } from "@/lib/admin/queries";
import { getMemoryStore, memoryId } from "@/lib/admin/memory-store";
import { isDatabaseReady, invalidateDatabaseCheck } from "@/lib/admin/db";
import { generateOrderNumber, generateTrackingToken } from "@/lib/utils";
import {
  ORDER_GUARD_CONFIG,
  checkOrderSpamAndRateLimit,
  getCachedIdempotencyOrder,
  getClientIpSafe,
  normalizeActorPhone,
  recordSuccessfulOrderAttempt,
  releaseInFlightOrderKey,
  saveCachedIdempotencyOrder,
  tryAcquireInFlightOrderKey,
} from "@/lib/security/order-guard";
import {
  ACTIVE_BILL_STATUSES,
  findMemoryTableByNumber,
  generateTableSessionToken,
  isSessionOwnedBy,
  normalizeTableNumber,
  resolveOrCreateMemoryTableSession,
  syncDbTableSessionLifecycle,
  syncMemoryTableSessionLifecycle,
} from "@/lib/orders/table-session";
import {
  finalizeDbCartAfterCheckout,
  finalizeMemoryCartAfterCheckout,
} from "@/lib/orders/cart-sync";

// Background automatic expiry sweep (berjalan ringan di Node runtime)
const globalForSweeper = globalThis as unknown as {
  __warkopExpirySweeperStarted?: boolean;
};

function ensureBackgroundExpirySweeper() {
  if (globalForSweeper.__warkopExpirySweeperStarted) return;
  globalForSweeper.__warkopExpirySweeperStarted = true;
  if (typeof setInterval === "function") {
    const timer = setInterval(() => {
      cleanupExpiredOrders().catch(() => {});
    }, 30_000);
    if (typeof timer === "object" && timer !== null && "unref" in timer) {
      (timer as { unref: () => void }).unref();
    }
  }
}

/**
 * Otomatis membersihkan pesanan PENDING yang telah melewati batas waktu expires_at,
 * melepaskan reserved stok, dan menutup sesi meja hanya bila seluruh bill di sesi tersebut batal/kosong.
 */
export async function cleanupExpiredOrders(): Promise<number> {
  const now = new Date();
  let expiredCount = 0;

  // 1. Bersihkan di Database Prisma (memanfaatkan Stored Procedure sp_release_expired_orders jika tersedia)
  try {
    if (await isDatabaseReady()) {
      try {
        // Panggil Stored Procedure MySQL sp_release_expired_orders
        await prisma.$executeRawUnsafe(`CALL sp_release_expired_orders()`);
      } catch (spErr) {
        // Fallback orm transaction jika SP belum di-load
      }
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: "PENDING",
          expires_at: { lt: now },
          payment: { status: { not: "PAID" } },
        },
        include: { items: true, table: true },
      });

      for (const order of expiredOrders) {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { status: "CANCELLED" },
          });

          await tx.payment.updateMany({
            where: { order_id: order.id },
            data: { status: "FAILED" },
          });

          for (const item of order.items) {
            const stock = await tx.productStock.findUnique({
              where: { product_id: item.product_id },
            });
            if (stock) {
              const availAfter = stock.available_qty + item.quantity;
              const resAfter = Math.max(0, stock.reserved_qty - item.quantity);
              await tx.productStock.update({
                where: { product_id: item.product_id },
                data: { available_qty: availAfter, reserved_qty: resAfter },
              });
              await tx.product.update({
                where: { id: item.product_id },
                data: { is_available: availAfter > 0 },
              });
              await tx.stockMovement.create({
                data: {
                  product_id: item.product_id,
                  order_id: order.id,
                  movement_type: "RELEASE_RESERVE",
                  qty_change: item.quantity,
                  available_before: stock.available_qty,
                  available_after: availAfter,
                  reserved_before: stock.reserved_qty,
                  reserved_after: resAfter,
                  reason: `Batas waktu pembayaran pesanan ${order.order_number} habis`,
                },
              });
            }
          }

          if (order.table_id) {
            await syncDbTableSessionLifecycle(tx, order.table_id);
          }
        });
        safeRevalidate(`/orders/${order.order_number}`);
        expiredCount++;
      }
      // Pastikan meja yang tidak lagi memiliki pesanan aktif ikut dikosongkan
      const occupiedTables = await prisma.table.findMany({
        where: { status: "OCCUPIED" },
        select: { id: true },
      });
      for (const tbl of occupiedTables) {
        await prisma.$transaction(async (tx) => {
          await syncDbTableSessionLifecycle(tx, tbl.id);
        });
      }
    }
  } catch {
    // Abaikan error DB saat tidak tersedia
  }

  // 2. Bersihkan di Memory Fallback Store
  try {
    const mem = getMemoryStore();
    for (const order of memoryOrders.values()) {
      if (
        order.status === "PENDING" &&
        order.payment?.status !== "PAID" &&
        order.expires_at &&
        new Date(order.expires_at) < now
      ) {
        order.status = "CANCELLED";
        if (order.payment) order.payment.status = "FAILED";

        for (const item of order.items) {
          const prod = item.product_id
            ? mem.products.get(item.product_id)
            : [...mem.products.values()].find((p) => p.name === item.product_name_snapshot);
          const st = prod ? mem.stocks.get(prod.id) : undefined;
          if (prod && st) {
            const availBefore = st.available_qty;
            const resBefore = st.reserved_qty;
            st.available_qty = availBefore + item.quantity;
            st.reserved_qty = Math.max(0, resBefore - item.quantity);
            st.updated_at = now;
            if (st.available_qty > 0 && prod.deleted_at === null) {
              prod.is_available = true;
            }
            mem.movements.unshift({
              id: memoryId("mov"),
              product_id: prod.id,
              actor_id: null,
              actor_name: "Sistem Kedaluwarsa",
              movement_type: "RELEASE_RESERVE",
              qty_change: item.quantity,
              available_before: availBefore,
              available_after: st.available_qty,
              reserved_before: resBefore,
              reserved_after: st.reserved_qty,
              reason: `Batas waktu pembayaran pesanan ${order.order_number} habis`,
              created_at: now,
            });
          }
        }

        if (order.table?.table_number) {
          const targetTable = findMemoryTableByNumber(order.table.table_number);
          if (targetTable) {
            syncMemoryTableSessionLifecycle(targetTable.id);
          }
        }
        safeRevalidate(`/orders/${order.order_number}`);
        expiredCount++;
      }
    }
  } catch {
    // Abaikan error memory cleanup
  }

  if (expiredCount > 0) {
    safeRevalidate("/checkout");
    safeRevalidate("/cashier");
    safeRevalidate("/menu");
  }

  return expiredCount;
}

/**
 * Batalkan pesanan PENDING (secara mandiri oleh customer atau kasir),
 * langsung melepaskan stok dan menyinkronkan sesi meja.
 */
export async function cancelPendingOrderAction(orderNumber: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Coba di Prisma DB bila tersambung
    if (await isDatabaseReady()) {
      try {
        const order = await prisma.order.findUnique({
          where: { order_number: orderNumber },
          include: { items: true, payment: true },
        });

        if (order) {
          if (order.status !== "PENDING" && order.payment?.status === "PAID") {
            return {
              success: false,
              error: "Pesanan yang sudah lunas tidak dapat dibatalkan secara otomatis.",
            };
          }
          if (order.status === "CANCELLED") {
            return { success: true, message: "Pesanan sudah berstatus dibatalkan." };
          }

          let sessionClosed = false;
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: { status: "CANCELLED" },
            });

            await tx.payment.updateMany({
              where: { order_id: order.id },
              data: { status: "FAILED" },
            });

            for (const item of order.items) {
              const stock = await tx.productStock.findUnique({
                where: { product_id: item.product_id },
              });
              if (stock) {
                const availAfter = stock.available_qty + item.quantity;
                const resAfter = Math.max(0, stock.reserved_qty - item.quantity);
                await tx.productStock.update({
                  where: { product_id: item.product_id },
                  data: { available_qty: availAfter, reserved_qty: resAfter },
                });
                await tx.product.update({
                  where: { id: item.product_id },
                  data: { is_available: availAfter > 0 },
                });
                await tx.stockMovement.create({
                  data: {
                    product_id: item.product_id,
                    order_id: order.id,
                    movement_type: "RELEASE_RESERVE",
                    qty_change: item.quantity,
                    available_before: stock.available_qty,
                    available_after: availAfter,
                    reserved_before: stock.reserved_qty,
                    reserved_after: resAfter,
                    reason: `Pembatalan pesanan PENDING ${order.order_number}`,
                  },
                });
              }
            }

            if (order.table_id) {
              const syncRes = await syncDbTableSessionLifecycle(tx, order.table_id);
              sessionClosed = syncRes.closed;
            }
          });

          safeRevalidate(`/orders/${orderNumber}`);
          safeRevalidate("/checkout");
          safeRevalidate("/cashier");
          return {
            success: true,
            message: sessionClosed
              ? "Pesanan dibatalkan dan meja telah dikosongkan."
              : "Pesanan dibatalkan. Bill lain pada sesi meja ini masih aktif.",
          };
        }
      } catch {
        // Fallback ke memory
      }
    }

    // Fallback di memory
    const fallback = memoryOrders.get(orderNumber);
    if (fallback) {
      if (fallback.status !== "PENDING" && fallback.payment?.status === "PAID") {
        return { success: false, error: "Pesanan yang sudah lunas tidak dapat dibatalkan." };
      }
      if (fallback.status === "CANCELLED") {
        return { success: true, message: "Pesanan sudah berstatus dibatalkan." };
      }

      const now = new Date();
      fallback.status = "CANCELLED";
      if (fallback.payment) fallback.payment.status = "FAILED";

      const mem = getMemoryStore();
      for (const item of fallback.items) {
        const prod = item.product_id
          ? mem.products.get(item.product_id)
          : [...mem.products.values()].find((p) => p.name === item.product_name_snapshot);
        const st = prod ? mem.stocks.get(prod.id) : undefined;
        if (prod && st) {
          const availBefore = st.available_qty;
          const resBefore = st.reserved_qty;
          st.available_qty = availBefore + item.quantity;
          st.reserved_qty = Math.max(0, resBefore - item.quantity);
          st.updated_at = now;
          if (st.available_qty > 0 && prod.deleted_at === null) {
            prod.is_available = true;
          }
          mem.movements.unshift({
            id: memoryId("mov"),
            product_id: prod.id,
            actor_id: null,
            actor_name: fallback.customer_name,
            movement_type: "RELEASE_RESERVE",
            qty_change: item.quantity,
            available_before: availBefore,
            available_after: st.available_qty,
            reserved_before: resBefore,
            reserved_after: st.reserved_qty,
            reason: `Pembatalan pesanan PENDING ${fallback.order_number}`,
            created_at: now,
          });
        }
      }

      let sessionClosed = false;
      if (fallback.table?.table_number) {
        const targetTable = findMemoryTableByNumber(fallback.table.table_number);
        if (targetTable) {
          const syncRes = syncMemoryTableSessionLifecycle(targetTable.id);
          sessionClosed = syncRes.closed;
        }
      }

      safeRevalidate(`/orders/${orderNumber}`);
      safeRevalidate("/checkout");
      safeRevalidate("/cashier");
      return {
        success: true,
        message: sessionClosed
          ? "Pesanan dibatalkan dan meja telah dikosongkan."
          : "Pesanan dibatalkan. Bill lain pada sesi meja ini masih aktif.",
      };
    }

    return { success: false, error: "Pesanan tidak ditemukan." };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membatalkan pesanan.",
    };
  }
}

export async function createOrder(input: CheckoutInput) {
  ensureBackgroundExpirySweeper();
  const idempotencyKey = input.idempotencyKey?.trim() || null;

  // 0. Idempotency check pertama sebelum spam/rate-limit agar retry aman tidak terblokir
  if (idempotencyKey) {
    const cached = getCachedIdempotencyOrder(idempotencyKey);
    if (cached) {
      return {
        success: true,
        orderNumber: cached.orderNumber,
        trackingToken: cached.trackingToken,
        tableSessionToken: cached.tableSessionToken ?? null,
        deduplicated: true,
      };
    }
    for (const memOrder of memoryOrders.values()) {
      if (memOrder.idempotency_key === idempotencyKey) {
        const memStore = getMemoryStore();
        const sess = memOrder.table_session_id
          ? memStore.tableSessions.get(memOrder.table_session_id)
          : undefined;
        return {
          success: true,
          orderNumber: memOrder.order_number,
          trackingToken: memOrder.tracking_token,
          tableSessionToken: sess?.session_token ?? null,
          ownerUserId: memOrder.user_id ?? null,
          deduplicated: true,
        };
      }
    }
  }

  if (!tryAcquireInFlightOrderKey(idempotencyKey)) {
    return {
      success: false,
      error: "Permintaan pesanan yang sama sedang diproses. Mohon tunggu sebentar.",
    };
  }

  try {
    // 1. Bersihkan pesanan PENDING yang kedaluwarsa sebelum validasi meja & kuota
    await cleanupExpiredOrders().catch(() => {});

    if (!input.customerName?.trim()) {
      return { success: false, error: "Nama pelanggan wajib diisi." };
    }
    const cleanPhone = (input.customerPhone || "").trim();
    if (!cleanPhone || cleanPhone === "-" || cleanPhone.replace(/\D/g, "").length < 8) {
      return {
        success: false,
        error: "Nomor WhatsApp aktif wajib diisi dengan benar (minimal 8 digit).",
      };
    }
    if (input.serviceType === "DINE_IN" && !input.tableNumber) {
      return { success: false, error: "Pilih nomor meja untuk pesanan Dine In." };
    }
    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Keranjang pesanan masih kosong." };
    }
    for (const it of input.items) {
      if (!Number.isFinite(it.quantity) || it.quantity <= 0 || it.quantity > 99) {
        return { success: false, error: `Jumlah item "${it.name}" tidak valid.` };
      }
    }

    const storeSettings = await getPublicStoreSettings();
    if (!storeSettings.isWebOrderingOpen) {
      return {
        success: false,
        error: "Maaf, pemesanan melalui web sedang ditutup sementara oleh admin.",
      };
    }

    // 2. Identifikasi user & periksa DB Idempotency bila DB ready
    const session = await getSession().catch(() => null);
    const effectiveUserId = input.userId === null ? null : (session?.sub ?? null);
    const dbReady = await isDatabaseReady();

    if (idempotencyKey && dbReady) {
      try {
        const existingDb = await prisma.order.findUnique({
          where: { idempotency_key: idempotencyKey },
          include: { table_session: true },
        });
        if (existingDb) {
          saveCachedIdempotencyOrder(idempotencyKey, {
            orderNumber: existingDb.order_number,
            trackingToken: existingDb.tracking_token ?? "",
            tableSessionToken: existingDb.table_session?.session_token ?? null,
          });
          return {
            success: true,
            orderNumber: existingDb.order_number,
            trackingToken: existingDb.tracking_token,
            tableSessionToken: existingDb.table_session?.session_token ?? null,
            ownerUserId: existingDb.user_id,
            deduplicated: true,
          };
        }
      } catch {
        // Abaikan jika fallback ke memory
      }
    }

    let validUserId: string | null = effectiveUserId;
    if (effectiveUserId && dbReady) {
      try {
        const userCheck = await prisma.user.findUnique({
          where: { id: effectiveUserId },
          select: { id: true },
        });
        validUserId = userCheck?.id ?? null;
      } catch {
        validUserId = null;
      }
    }

    // 3. Anti-Spam & Rate Limiting Check
    const clientIp = await getClientIpSafe();
    const rateCheck = checkOrderSpamAndRateLimit({
      ip: clientIp,
      userId: validUserId,
      customerPhone: cleanPhone,
    });
    if (!rateCheck.ok) {
      return { success: false, error: rateCheck.error };
    }

    // 4. Batas Maksimal Pesanan PENDING Belum Dibayar Bersamaan
    const normalizedPhone = normalizeActorPhone(cleanPhone);
    let pendingUnpaidCount = 0;

    if (dbReady) {
      try {
        const pendingOrders = await prisma.order.findMany({
          where: {
            status: "PENDING",
            payment: { status: { not: "PAID" } },
            OR: [
              ...(validUserId ? [{ user_id: validUserId }] : []),
              { customer_phone: cleanPhone },
            ],
          },
          select: { id: true, customer_phone: true, user_id: true },
        });
        pendingUnpaidCount = pendingOrders.filter(
          (o) =>
            (validUserId && o.user_id === validUserId) ||
            normalizeActorPhone(o.customer_phone) === normalizedPhone
        ).length;
      } catch {
        // Lanjut hitung memory fallback
      }
    }

    const memPendingCount = [...memoryOrders.values()].filter(
      (o) =>
        o.status === "PENDING" &&
        o.payment?.status !== "PAID" &&
        ((validUserId && o.user_id === validUserId) ||
          normalizeActorPhone(o.customer_phone) === normalizedPhone)
    ).length;

    if (Math.max(pendingUnpaidCount, memPendingCount) >= ORDER_GUARD_CONFIG.maxPendingUnpaidOrders) {
      return {
        success: false,
        error: `Anda memiliki ${ORDER_GUARD_CONFIG.maxPendingUnpaidOrders} pesanan yang masih menunggu pembayaran. Selesaikan pembayaran atau batalkan pesanan sebelumnya terlebih dahulu.`,
      };
    }

    // 5. Hitung total & masa kedaluwarsa pembayaran
    let subtotal = 0;
    for (const item of input.items) {
      const optionsSum = item.options.reduce(
        (sum, opt) => sum + (Number(opt.priceAdjustment) || 0),
        0
      );
      subtotal += (item.unitPrice + optionsSum) * item.quantity;
    }

    const taxAmount = 0;
    const totalAmount = subtotal;
    const orderNumber = generateOrderNumber();
    const trackingToken = generateTrackingToken();

    const expiryMinutes =
      input.paymentMethod === "CASH"
        ? storeSettings.cashExpiryMinutes
        : storeSettings.digitalExpiryMinutes;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // 6A. Jalankan melalui Prisma MySQL (ACID) jika DB tersedia
    if (dbReady) {
      try {
        const created = await withDistributedTransaction(
          async (tx) => {
            let selectedTableId: string | null = null;
            let resolvedTableSessionId: string | null = null;
            let resolvedTableSessionToken: string | null = null;

            if (input.serviceType === "DINE_IN" && input.tableNumber) {
              const { raw, clean, padded } = normalizeTableNumber(input.tableNumber);
              const table = await tx.table.findFirst({
                where: {
                  OR: [
                    { table_number: raw },
                    { table_number: clean },
                    { table_number: padded },
                  ],
                },
              });

              if (table) {
                selectedTableId = table.id;
                const activeSession = await tx.tableSession.findFirst({
                  where: { table_id: table.id, status: "ACTIVE" },
                  orderBy: { opened_at: "desc" },
                });

                if (activeSession) {
                  const owned = isSessionOwnedBy({
                    ownerUserId: activeSession.owner_user_id,
                    ownerPhone: activeSession.owner_phone,
                    sessionToken: activeSession.session_token,
                    requesterUserId: validUserId,
                    requesterPhone: cleanPhone,
                    requesterSessionToken: input.tableSessionToken,
                  });
                  if (!owned) {
                    throw new Error(
                      `Meja ${clean} sedang memiliki sesi kunjungan aktif oleh pelanggan lain. Silakan pilih meja yang kosong.`
                    );
                  }
                  resolvedTableSessionId = activeSession.id;
                  resolvedTableSessionToken = activeSession.session_token;
                } else {
                  const legacyOrders = await tx.order.findMany({
                    where: {
                      table_id: table.id,
                      service_type: "DINE_IN",
                      status: { in: [...ACTIVE_BILL_STATUSES] },
                    },
                    select: { id: true, user_id: true, customer_phone: true },
                  });

                  if (table.status === "OCCUPIED" && legacyOrders.length === 0) {
                    throw new Error(
                      `Meja ${clean} saat ini sedang terisi/ditempati pelanggan lain. Silakan pilih meja yang kosong.`
                    );
                  }

                  if (legacyOrders.length > 0) {
                    const sameOwner = legacyOrders.some((lo) =>
                      isSessionOwnedBy({
                        ownerUserId: lo.user_id,
                        ownerPhone: lo.customer_phone,
                        requesterUserId: validUserId,
                        requesterPhone: cleanPhone,
                      })
                    );
                    if (!sameOwner) {
                      throw new Error(
                        `Meja ${clean} saat ini sedang terisi/ditempati pelanggan lain. Silakan pilih meja yang kosong.`
                      );
                    }
                  }

                  const newSessionToken =
                    input.tableSessionToken || generateTableSessionToken(table.table_number);
                  const createdSess = await tx.tableSession.create({
                    data: {
                      table_id: table.id,
                      session_token: newSessionToken,
                      owner_user_id: validUserId,
                      owner_phone: normalizedPhone || null,
                      owner_name: input.customerName.trim(),
                      status: "ACTIVE",
                    },
                  });
                  resolvedTableSessionId = createdSess.id;
                  resolvedTableSessionToken = createdSess.session_token;

                  if (legacyOrders.length > 0) {
                    await tx.order.updateMany({
                      where: { id: { in: legacyOrders.map((o) => o.id) } },
                      data: { table_session_id: createdSess.id },
                    });
                  }
                }
              }
            }

            // Cek & Reservasi Stok
            for (const item of input.items) {
              let resolvedProductId = item.productId;
              let existingProduct = await tx.product.findUnique({
                where: { id: resolvedProductId },
                select: { id: true, is_available: true, deleted_at: true },
              });

              if (!existingProduct) {
                existingProduct = await tx.product.findFirst({
                  where: { name: item.name, deleted_at: null },
                  select: { id: true, is_available: true, deleted_at: true },
                });
                if (existingProduct) {
                  resolvedProductId = existingProduct.id;
                  item.productId = existingProduct.id;
                }
              }

              if (!existingProduct || existingProduct.deleted_at !== null) {
                throw new Error(`Menu "${item.name}" sudah tidak tersedia di katalog.`);
              }
              if (!existingProduct.is_available) {
                throw new Error(`Menu "${item.name}" saat ini sedang habis atau dinonaktifkan.`);
              }

              const stock = await tx.productStock.findUnique({
                where: { product_id: resolvedProductId },
              });

              if (stock) {
                if (stock.available_qty < item.quantity) {
                  throw new Error(
                    `Stok menu "${item.name}" tidak mencukupi (Tersedia: ${stock.available_qty}, Diminta: ${item.quantity}).`
                  );
                }

                const availAfter = stock.available_qty - item.quantity;
                const resAfter = stock.reserved_qty + item.quantity;

                await tx.productStock.update({
                  where: { product_id: resolvedProductId },
                  data: {
                    available_qty: availAfter,
                    reserved_qty: resAfter,
                  },
                });

                await tx.product.update({
                  where: { id: resolvedProductId },
                  data: { is_available: availAfter > 0 },
                });

                await tx.stockMovement.create({
                  data: {
                    product_id: resolvedProductId,
                    movement_type: "RESERVE",
                    qty_change: -item.quantity,
                    available_before: stock.available_qty,
                    available_after: availAfter,
                    reserved_before: stock.reserved_qty,
                    reserved_after: resAfter,
                    reason: `Reservasi stok pesanan ${orderNumber}`,
                  },
                });
              }
            }

            // Buat Header Pesanan
            const order = await tx.order.create({
              data: {
                order_number: orderNumber,
                user_id: validUserId,
                table_id: selectedTableId,
                table_session_id: resolvedTableSessionId,
                customer_name: input.customerName.trim(),
                customer_phone: cleanPhone,
                tracking_token: trackingToken,
                idempotency_key: idempotencyKey,
                source: "WEB",
                service_type: input.serviceType,
                status: "PENDING",
                subtotal,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                notes: input.notes?.trim() || null,
                expires_at: expiresAt,
              },
            });

            // Buat Detail Item & Varian
            for (const item of input.items) {
              const optionsTotal = item.options.reduce(
                (s, o) => s + (Number(o.priceAdjustment) || 0),
                0
              );
              const itemSubtotal = (item.unitPrice + optionsTotal) * item.quantity;

              const orderItem = await tx.orderItem.create({
                data: {
                  order_id: order.id,
                  product_id: item.productId,
                  product_name_snapshot: item.name,
                  unit_price_snapshot: item.unitPrice,
                  quantity: item.quantity,
                  subtotal: itemSubtotal,
                  item_notes: item.itemNotes || null,
                },
              });

              for (const opt of item.options) {
                await tx.orderItemOption.create({
                  data: {
                    order_item_id: orderItem.id,
                    option_group_name_snapshot: opt.groupName,
                    option_name_snapshot: opt.optionName,
                    price_adjustment_snapshot: opt.priceAdjustment,
                  },
                });
              }
            }

            // Rekaman Pembayaran
            await tx.payment.create({
              data: {
                order_id: order.id,
                method: input.paymentMethod === "CASH" ? "CASH" : "QRIS",
                status: "UNPAID",
                amount_due: totalAmount,
                amount_paid: 0,
                change_amount: 0,
              },
            });

            if (selectedTableId) {
              await tx.table.update({
                where: { id: selectedTableId },
                data: { status: "OCCUPIED" },
              });
            }

            // Sinkronkan keranjang aktif di database hanya setelah order sukses tersimpan
            await finalizeDbCartAfterCheckout(tx, {
              cartToken: input.cartToken,
              userId: validUserId,
              processedItemIds: input.checkoutItemIds,
            });

            return {
              order,
              tableSessionId: resolvedTableSessionId,
              tableSessionToken: resolvedTableSessionToken,
            };
          },
          { operationName: "CheckoutOrder", timeoutMs: 20000 }
        );

        // Sinkronkan juga fallback memori cart
        finalizeMemoryCartAfterCheckout({
          cartToken: input.cartToken,
          userId: validUserId,
          processedItemIds: input.checkoutItemIds,
        });

        recordSuccessfulOrderAttempt({
          ip: clientIp,
          userId: validUserId,
          customerPhone: cleanPhone,
        });
        saveCachedIdempotencyOrder(idempotencyKey, {
          orderNumber: created.order.order_number,
          trackingToken: created.order.tracking_token ?? trackingToken,
          tableSessionToken: created.tableSessionToken,
        });
        safeRevalidate("/checkout");
        safeRevalidate("/cashier");

        return {
          success: true,
          orderNumber: created.order.order_number,
          trackingToken: created.order.tracking_token,
          tableSessionToken: created.tableSessionToken,
          tableSessionId: created.tableSessionId,
          ownerUserId: validUserId,
        };
      } catch (dbError: unknown) {
        const msg = dbError instanceof Error ? dbError.message : String(dbError);
        if (msg.startsWith("Stok ") || msg.startsWith("Menu ") || msg.startsWith("Meja ")) {
          return { success: false, error: msg };
        }
        invalidateDatabaseCheck();
        console.warn("[createOrder DB fallback ke memory]:", msg);
      }
    }

    // 6B. Fallback In-Memory Store (saat MySQL offline/belum terhubung)
    const mem = getMemoryStore();
    const now = new Date();
    let resolvedTable: { table_number: string; name: string } | null = null;
    let resolvedSessionId: string | null = null;
    let resolvedSessionToken: string | null = null;

    if (input.serviceType === "DINE_IN" && input.tableNumber) {
      const memTable = findMemoryTableByNumber(input.tableNumber);
      if (memTable) {
        const sessRes = resolveOrCreateMemoryTableSession({
          table: memTable,
          userId: validUserId,
          customerPhone: cleanPhone,
          customerName: input.customerName.trim(),
          tableSessionToken: input.tableSessionToken,
        });
        if (!sessRes.ok) {
          return { success: false, error: sessRes.error };
        }
        resolvedSessionId = sessRes.session.id;
        resolvedSessionToken = sessRes.session.session_token;
        resolvedTable = { table_number: memTable.table_number, name: memTable.name };
      } else {
        const cleanNum = normalizeTableNumber(input.tableNumber).clean;
        resolvedTable = { table_number: input.tableNumber, name: `Meja ${cleanNum}` };
      }
    }

    // Validasi & resolusi produk + stok terlebih dahulu sebelum mutasi (atomik)
    const resolvedItems: {
      productId: string;
      name: string;
      unitPrice: number;
      quantity: number;
      itemNotes?: string;
      options: CheckoutInput["items"][number]["options"];
    }[] = [];

    for (const item of input.items) {
      let prod = mem.products.get(item.productId);
      if (!prod) {
        prod = [...mem.products.values()].find(
          (p) => p.name === item.name && p.deleted_at === null
        );
      }
      if (!prod || prod.deleted_at !== null) {
        return { success: false, error: `Menu "${item.name}" sudah tidak tersedia di katalog.` };
      }
      if (!prod.is_available) {
        return {
          success: false,
          error: `Menu "${item.name}" saat ini sedang habis atau dinonaktifkan.`,
        };
      }
      const st = mem.stocks.get(prod.id);
      if (st && st.available_qty < item.quantity) {
        return {
          success: false,
          error: `Stok menu "${item.name}" tidak mencukupi (Tersedia: ${st.available_qty}, Diminta: ${item.quantity}).`,
        };
      }
      resolvedItems.push({
        productId: prod.id,
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        itemNotes: item.itemNotes,
        options: item.options,
      });
    }

    // Mutasi stok in-memory
    for (const rItem of resolvedItems) {
      const prod = mem.products.get(rItem.productId);
      const st = mem.stocks.get(rItem.productId);
      if (st) {
        const availBefore = st.available_qty;
        const resBefore = st.reserved_qty;
        st.available_qty = availBefore - rItem.quantity;
        st.reserved_qty = resBefore + rItem.quantity;
        st.updated_at = now;
        if (prod && st.available_qty <= 0) {
          prod.is_available = false;
        }
        mem.movements.unshift({
          id: memoryId("mov"),
          product_id: rItem.productId,
          actor_id: validUserId,
          actor_name: input.customerName.trim(),
          movement_type: "RESERVE",
          qty_change: -rItem.quantity,
          available_before: availBefore,
          available_after: st.available_qty,
          reserved_before: resBefore,
          reserved_after: st.reserved_qty,
          reason: `Reservasi stok pesanan ${orderNumber}`,
          created_at: now,
        });
      }
    }

    const memOrder: OrderDetailData = {
      id: memoryId("ord"),
      order_number: orderNumber,
      user_id: validUserId,
      table_session_id: resolvedSessionId,
      idempotency_key: idempotencyKey,
      customer_name: input.customerName.trim(),
      customer_phone: cleanPhone,
      tracking_token: trackingToken,
      source: "WEB",
      service_type: input.serviceType,
      status: "PENDING",
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: input.notes?.trim() || null,
      expires_at: expiresAt,
      created_at: now,
      table: resolvedTable,
      items: resolvedItems.map((it, idx) => {
        const optionsTotal = it.options.reduce((s, o) => s + (Number(o.priceAdjustment) || 0), 0);
        return {
          id: memoryId(`oi-${idx}`),
          product_id: it.productId,
          product_name_snapshot: it.name,
          unit_price_snapshot: it.unitPrice,
          quantity: it.quantity,
          subtotal: (it.unitPrice + optionsTotal) * it.quantity,
          item_notes: it.itemNotes || null,
          options: it.options.map((opt) => ({
            option_group_name_snapshot: opt.groupName,
            option_name_snapshot: opt.optionName,
            price_adjustment_snapshot: opt.priceAdjustment,
          })),
        };
      }),
      payment: {
        id: memoryId("pay"),
        method: input.paymentMethod === "CASH" ? "CASH" : "QRIS",
        status: "UNPAID",
        amount_due: totalAmount,
        amount_paid: 0,
        change_amount: 0,
        paid_at: null,
      },
    };

    memoryOrders.set(orderNumber, memOrder);

    // Sinkronkan keranjang aktif di memory store hanya setelah order sukses dibuat
    finalizeMemoryCartAfterCheckout({
      cartToken: input.cartToken,
      userId: validUserId,
      processedItemIds: input.checkoutItemIds,
    });

    recordSuccessfulOrderAttempt({
      ip: clientIp,
      userId: validUserId,
      customerPhone: cleanPhone,
    });
    saveCachedIdempotencyOrder(idempotencyKey, {
      orderNumber,
      trackingToken,
      tableSessionToken: resolvedSessionToken,
    });
    safeRevalidate("/checkout");
    safeRevalidate("/cashier");

    return {
      success: true,
      orderNumber,
      trackingToken,
      tableSessionToken: resolvedSessionToken,
      tableSessionId: resolvedSessionId,
      ownerUserId: validUserId,
    };
  } catch (err: unknown) {
    console.error("Gagal membuat pesanan:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal server.",
    };
  } finally {
    releaseInFlightOrderKey(idempotencyKey);
  }
}

export async function getOrderDetail(
  orderNumber: string
): Promise<{ success: boolean; data?: OrderDetailData; error?: string }> {
  try {
    await cleanupExpiredOrders().catch(() => {});
    if (await isDatabaseReady()) {
      const order = await prisma.order.findUnique({
        where: { order_number: orderNumber },
        include: {
          table: true,
          payment: true,
          items: {
            include: {
              options: true,
            },
          },
        },
      });

      if (order) {
        return {
          success: true,
          data: {
            ...order,
            table: order.table
              ? { table_number: order.table.table_number, name: order.table.name }
              : null,
            subtotal: Number(order.subtotal),
            tax_amount: Number(order.tax_amount),
            total_amount: Number(order.total_amount),
            items: order.items.map((it) => ({
              ...it,
              unit_price_snapshot: Number(it.unit_price_snapshot),
              subtotal: Number(it.subtotal),
              options: it.options.map((opt) => ({
                ...opt,
                price_adjustment_snapshot: Number(opt.price_adjustment_snapshot),
              })),
            })),
            payment: order.payment
              ? {
                  ...order.payment,
                  amount_due: Number(order.payment.amount_due),
                  amount_paid: Number(order.payment.amount_paid),
                  change_amount: Number(order.payment.change_amount),
                }
              : null,
          },
        };
      }
    }
  } catch {
    console.warn("Mencari di fallback memory order:", orderNumber);
  }

  // Cek di memory fallback
  const fallback = memoryOrders.get(orderNumber);
  if (fallback) {
    return { success: true, data: fallback };
  }

  return { success: false, error: "Pesanan tidak ditemukan." };
}

export interface CustomerRecentOrderSummary {
  orderNumber: string;
  trackingToken: string | null;
  totalAmount: number;
  status: string;
  itemCount: number;
  createdAt: string;
  serviceType: string;
  tableNumber?: string | null;
  itemsSummary: string;
}

/**
 * Mengambil daftar riwayat pesanan milik akun pelanggan yang sedang login dari database.
 * Guest (belum login) mengembalikan userId: null dan orders: [] agar tidak bercampur dengan histori akun.
 */
export async function getCustomerRecentOrders(): Promise<{
  success: boolean;
  orders: CustomerRecentOrderSummary[];
  userId: string | null;
  userName: string | null;
}> {
  const session = await getSession();
  if (!session || !session.sub) {
    return { success: true, orders: [], userId: null, userName: null };
  }

  try {
    await cleanupExpiredOrders().catch(() => {});

    const orders: CustomerRecentOrderSummary[] = [];
    if (await isDatabaseReady()) {
      const dbOrders = await prisma.order.findMany({
        where: {
          user_id: session.sub,
        },
        orderBy: { created_at: "desc" },
        take: 25,
        include: {
          table: true,
          items: true,
        },
      });

      for (const o of dbOrders) {
        orders.push({
          orderNumber: o.order_number,
          trackingToken: o.tracking_token,
          totalAmount: Number(o.total_amount),
          status: o.status,
          itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
          createdAt: o.created_at.toISOString(),
          serviceType: o.service_type,
          tableNumber: o.table?.table_number || null,
          itemsSummary: o.items.map((it) => `${it.quantity}x ${it.product_name_snapshot}`).join(", "),
        });
      }
    }

    // Sertakan fallback in-memory milik user ini saja (bila ada saat koneksi DB sempat terganggu)
    const seen = new Set(orders.map((o) => o.orderNumber));
    for (const memOrd of memoryOrders.values()) {
      if (memOrd.user_id === session.sub && !seen.has(memOrd.order_number)) {
        seen.add(memOrd.order_number);
        orders.push({
          orderNumber: memOrd.order_number,
          trackingToken: memOrd.tracking_token,
          totalAmount: Number(memOrd.total_amount),
          status: memOrd.status,
          itemCount: memOrd.items.reduce((sum, it) => sum + it.quantity, 0),
          createdAt: new Date(memOrd.created_at).toISOString(),
          serviceType: memOrd.service_type,
          tableNumber: memOrd.table?.table_number || null,
          itemsSummary: memOrd.items
            .map((it) => `${it.quantity}x ${it.product_name_snapshot}`)
            .join(", "),
        });
      }
    }

    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      success: true,
      orders,
      userId: session.sub,
      userName: session.name || null,
    };
  } catch (err) {
    console.warn("Gagal mengambil riwayat pesanan dari DB:", err);
    return {
      success: true,
      orders: [],
      userId: session.sub,
      userName: session.name || null,
    };
  }
}

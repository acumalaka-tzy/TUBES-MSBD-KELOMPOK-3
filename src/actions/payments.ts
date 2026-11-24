"use server";

import { getMemoryStore, memoryId } from "@/lib/admin/memory-store";
import { prisma } from "@/lib/prisma";
import { withDistributedTransaction } from "@/lib/db/distributed";
import { safeRevalidate, memoryOrders } from "./helpers";
import { cleanupExpiredOrders } from "./orders";
import {
  findMemoryTableByNumber,
  syncDbTableSessionLifecycle,
  syncMemoryTableSessionLifecycle,
} from "@/lib/orders/table-session";
import {
  createSnapTransaction,
  checkMidtransStatus,
  mapMidtransStatusToInternal,
  type MidtransStatusResponse,
} from "@/lib/midtrans";

interface CachedSnapSession {
  orderNumber: string;
  gatewayOrderId: string;
  token: string;
  redirectUrl: string;
}

const gSnap = globalThis as unknown as {
  __warkopSnapSessions?: Map<string, CachedSnapSession>;
};
const snapSessionsCache =
  gSnap.__warkopSnapSessions ?? (gSnap.__warkopSnapSessions = new Map());

async function resolveInternalOrderNumber(gatewayOrOrderNumber: string): Promise<string> {
  try {
    const exact = await prisma.order.findUnique({
      where: { order_number: gatewayOrOrderNumber },
      select: { order_number: true },
    });
    if (exact) return exact.order_number;

    const tx = await prisma.paymentTransaction.findFirst({
      where: { gateway_order_id: gatewayOrOrderNumber },
      orderBy: { received_at: "desc" },
      select: { payment: { select: { order: { select: { order_number: true } } } } },
    });
    if (tx?.payment?.order?.order_number) return tx.payment.order.order_number;
  } catch {
    // Abaikan jika DB belum terhubung
  }

  for (const s of snapSessionsCache.values()) {
    if (s.gatewayOrderId === gatewayOrOrderNumber) return s.orderNumber;
  }

  if (memoryOrders.has(gatewayOrOrderNumber)) return gatewayOrOrderNumber;

  const baseMatch = gatewayOrOrderNumber.match(/^(ORD-\d{8}-\d+)(?:-[A-Z0-9]+)?$/i);
  return baseMatch ? baseMatch[1] : gatewayOrOrderNumber;
}

async function resolveLatestGatewayOrderId(orderNumber: string): Promise<string> {
  const cached = snapSessionsCache.get(orderNumber);
  if (cached?.gatewayOrderId) return cached.gatewayOrderId;

  try {
    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
      select: {
        payment: {
          select: {
            transactions: {
              orderBy: { received_at: "desc" },
              take: 1,
              select: { gateway_order_id: true },
            },
          },
        },
      },
    });
    const dbGatewayId = order?.payment?.transactions?.[0]?.gateway_order_id;
    if (dbGatewayId) return dbGatewayId;
  } catch {
    // Fallback
  }
  return orderNumber;
}

/**
 * Ambil sesi Snap aktif yang sudah tersimpan atau buat transaksi Snap baru.
 * Mencegah error Midtrans "transaction_details.order_id sudah digunakan"
 * saat tombol Bayar Sekarang diklik ulang atau nomor order bentrok di Sandbox.
 */
export async function createOrReuseSnapSession(orderNumber: string): Promise<{
  success: boolean;
  statusCode?: number;
  alreadyPaid?: boolean;
  token?: string;
  redirectUrl?: string;
  clientKey?: string;
  isProduction?: boolean;
  isSimulation?: boolean;
  gatewayOrderId?: string;
  error?: string;
}> {
  try {
    if (!orderNumber) {
      return { success: false, statusCode: 400, error: "Nomor pesanan wajib disertakan." };
    }
    await cleanupExpiredOrders().catch(() => {});

    let customerName = "Pelanggan Warkop";
    let customerPhone = "-";
    let grossAmount = 0;
    let items: { id: string; price: number; quantity: number; name: string }[] = [];
    let dbPaymentId: string | null = null;
    let cachedSession: CachedSnapSession | undefined = snapSessionsCache.get(orderNumber);

    try {
      const order = await prisma.order.findUnique({
        where: { order_number: orderNumber },
        include: {
          items: true,
          payment: {
            include: {
              transactions: {
                where: { transaction_status: "SNAP_INIT" },
                orderBy: { received_at: "desc" },
                take: 1,
              },
            },
          },
        },
      });

      if (order) {
        if (order.status === "CANCELLED" || (order.expires_at && new Date(order.expires_at) < new Date())) {
          return {
            success: false,
            statusCode: 400,
            error: "Batas waktu pembayaran telah habis (Kedaluwarsa). Meja telah dikosongkan.",
          };
        }
        if (order.payment?.status === "PAID") {
          return {
            success: false,
            statusCode: 400,
            alreadyPaid: true,
            error: "Pesanan ini sudah lunas.",
          };
        }

        dbPaymentId = order.payment?.id ?? null;
        const dbInit = order.payment?.transactions?.[0];
        if (!cachedSession && dbInit?.raw_payload && typeof dbInit.raw_payload === "object") {
          const raw = dbInit.raw_payload as { token?: unknown; redirectUrl?: unknown };
          if (typeof raw.token === "string" && raw.token) {
            cachedSession = {
              orderNumber,
              gatewayOrderId: dbInit.gateway_order_id,
              token: raw.token,
              redirectUrl: typeof raw.redirectUrl === "string" ? raw.redirectUrl : "",
            };
            snapSessionsCache.set(orderNumber, cachedSession);
          }
        }

        customerName = order.customer_name;
        customerPhone = order.customer_phone || "-";
        grossAmount = Number(order.total_amount);
        items = order.items.map((it: any) => ({
          id: it.product_id || it.id,
          name: it.product_name_snapshot,
          price: it.subtotal ? Math.round(Number(it.subtotal) / it.quantity) : Number(it.unit_price_snapshot),
          quantity: it.quantity,
        }));
      }
    } catch {
      // Fallback ke memory
    }

    if (grossAmount === 0) {
      const fallback = memoryOrders.get(orderNumber);
      if (fallback) {
        if (
          fallback.status === "CANCELLED" ||
          (fallback.expires_at && new Date(fallback.expires_at) < new Date())
        ) {
          return {
            success: false,
            statusCode: 400,
            error: "Batas waktu pembayaran telah habis (Kedaluwarsa). Meja telah dikosongkan.",
          };
        }
        if (fallback.payment?.status === "PAID") {
          return {
            success: false,
            statusCode: 400,
            alreadyPaid: true,
            error: "Pesanan ini sudah lunas.",
          };
        }

        customerName = fallback.customer_name;
        customerPhone = fallback.customer_phone || "-";
        grossAmount = Number(fallback.total_amount);
        items = fallback.items.map((it) => ({
          id: it.product_id || it.id,
          name: it.product_name_snapshot,
          price: it.subtotal ? Math.round(Number(it.subtotal) / it.quantity) : Number(it.unit_price_snapshot),
          quantity: it.quantity,
        }));
      }
    }

    if (grossAmount <= 0) {
      return { success: false, statusCode: 404, error: `Pesanan ${orderNumber} tidak ditemukan.` };
    }

    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const clientKey =
      process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
      process.env.MIDTRANS_CLIENT_KEY ||
      "";

    // Jika pernah membuat token Snap sebelumnya, periksa apakah masih valid atau sudah dibayar
    let nextGatewayOrderId: string | undefined = undefined;
    if (cachedSession?.token) {
      const midStatus = await checkMidtransStatus(cachedSession.gatewayOrderId);
      const txSt = midStatus?.transaction_status?.toLowerCase();

      if (txSt === "settlement" || (txSt === "capture" && midStatus?.fraud_status !== "challenge")) {
        await applyMidtransPaymentUpdate(orderNumber, {
          transaction_status: midStatus!.transaction_status,
          fraud_status: midStatus!.fraud_status,
          payment_type: midStatus!.payment_type,
          gross_amount: midStatus!.gross_amount,
          transaction_id: midStatus!.transaction_id,
          gateway_order_id: cachedSession.gatewayOrderId,
          signature_verified: true,
          raw_payload: midStatus as unknown as Record<string, unknown>,
        });
        return {
          success: false,
          statusCode: 400,
          alreadyPaid: true,
          error: "Pembayaran pesanan ini sudah diterima oleh Midtrans.",
        };
      }

      if (txSt === "expire" || txSt === "cancel" || txSt === "deny" || txSt === "failure") {
        // Sesi Snap lama sudah mati di Midtrans -> paksa ID gateway baru dengan suffix
        snapSessionsCache.delete(orderNumber);
        const retryTag = Date.now().toString(36).slice(-4).toUpperCase();
        nextGatewayOrderId = `${orderNumber.slice(0, 44)}-${retryTag}`;
      } else {
        // Belum kadaluwarsa / belum dipilih metode -> pakai kembali token yang sama
        return {
          success: true,
          token: cachedSession.token,
          redirectUrl: cachedSession.redirectUrl,
          clientKey,
          isProduction,
          isSimulation: false,
          gatewayOrderId: cachedSession.gatewayOrderId,
        };
      }
    }

    const snapResult = await createSnapTransaction({
      orderNumber,
      gatewayOrderId: nextGatewayOrderId,
      customerName,
      customerPhone,
      grossAmount,
      items,
    });

    if (!snapResult.isSimulation && snapResult.token) {
      const savedSession: CachedSnapSession = {
        orderNumber,
        gatewayOrderId: snapResult.gatewayOrderId,
        token: snapResult.token,
        redirectUrl: snapResult.redirectUrl,
      };
      snapSessionsCache.set(orderNumber, savedSession);

      if (dbPaymentId) {
        try {
          await prisma.paymentTransaction.create({
            data: {
              payment_id: dbPaymentId,
              gateway_provider: "MIDTRANS",
              gateway_order_id: snapResult.gatewayOrderId,
              payment_type: "SNAP",
              transaction_status: "SNAP_INIT",
              gross_amount: grossAmount,
              signature_verified: false,
              raw_payload: {
                token: snapResult.token,
                redirectUrl: snapResult.redirectUrl,
              },
            },
          });
        } catch {
          // Cache in-memory tetap aktif
        }
      }
    }

    return {
      success: true,
      token: snapResult.token,
      redirectUrl: snapResult.redirectUrl,
      clientKey,
      isProduction,
      isSimulation: snapResult.isSimulation ?? false,
      gatewayOrderId: snapResult.gatewayOrderId,
    };
  } catch (err) {
    console.error(`[Midtrans] Gagal membuat Snap Action untuk ${orderNumber}:`, err);
    return {
      success: false,
      statusCode: 500,
      error: err instanceof Error ? err.message : "Gagal menghubungi Midtrans.",
    };
  }
}

/**
 * Buat Snap Token & Redirect URL untuk pembayaran Midtrans
 */
export async function createMidtransSnapAction(orderNumber: string) {
  return createOrReuseSnapSession(orderNumber);
}

/**
 * Terapkan pembaruan status pembayaran Midtrans ke Database / Memory
 */
export async function applyMidtransPaymentUpdate(
  gatewayOrOrderNumber: string,
  payload: {
    transaction_status: string;
    fraud_status?: string;
    payment_type?: string;
    gross_amount?: string | number;
    transaction_id?: string;
    gateway_order_id?: string;
    signature_verified?: boolean;
    raw_payload?: Record<string, unknown>;
  }
) {
  const orderNumber = await resolveInternalOrderNumber(gatewayOrOrderNumber);
  const gatewayOrderId = payload.gateway_order_id || gatewayOrOrderNumber;
  const { paymentStatus, orderStatus } = mapMidtransStatusToInternal(
    payload.transaction_status,
    payload.fraud_status
  );

  // 1. Coba update via Prisma
  try {
    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
      include: { payment: true, items: true },
    });

    if (order && order.payment) {
      const amount = payload.gross_amount ? Number(payload.gross_amount) : Number(order.total_amount);

      await withDistributedTransaction(
        async (tx: any) => {
        // Update payment
        await tx.payment.update({
          where: { id: order.payment!.id },
          data: {
            status: paymentStatus,
            amount_paid: paymentStatus === "PAID" ? amount : order.payment!.amount_paid,
            paid_at: paymentStatus === "PAID" ? new Date() : order.payment!.paid_at,
            method:
              payload.payment_type?.toUpperCase().includes("VA") ||
              payload.payment_type?.toUpperCase().includes("VIRTUAL")
                ? "VIRTUAL_ACCOUNT"
                : "QRIS",
          },
        });

        // Catat Payment Transaction jika ada
        if (payload.transaction_id) {
          await tx.paymentTransaction.upsert({
            where: { gateway_transaction_id: payload.transaction_id },
            create: {
              payment_id: order.payment!.id,
              gateway_provider: "MIDTRANS",
              gateway_order_id: gatewayOrderId,
              gateway_transaction_id: payload.transaction_id,
              payment_type: payload.payment_type || "MIDTRANS",
              transaction_status: payload.transaction_status,
              gross_amount: amount,
              signature_verified: payload.signature_verified ?? false,
              raw_payload: (payload.raw_payload as object) ?? undefined,
            },
            update: {
              transaction_status: payload.transaction_status,
              signature_verified: payload.signature_verified ?? false,
              raw_payload: (payload.raw_payload as object) ?? undefined,
            },
          });
        }

        // Update status order hanya jika belum berlanjut ke tahap dapur / selesai
        if (order.status === "PENDING") {
          await tx.order.update({
            where: { id: order.id },
            data: { status: orderStatus },
          });
        }

        // Update stok
        if (paymentStatus === "PAID" && order.payment!.status !== "PAID") {
          for (const item of order.items) {
            const stock = await tx.productStock.findUnique({
              where: { product_id: item.product_id },
            });
            if (stock) {
              const resAfter = Math.max(0, stock.reserved_qty - item.quantity);
              await tx.productStock.update({
                where: { product_id: item.product_id },
                data: { reserved_qty: resAfter },
              });
              await tx.stockMovement.create({
                data: {
                  product_id: item.product_id,
                  order_id: order.id,
                  movement_type: "SALE_DEDUCTION",
                  qty_change: 0,
                  available_before: stock.available_qty,
                  available_after: stock.available_qty,
                  reserved_before: stock.reserved_qty,
                  reserved_after: resAfter,
                  reason: `Midtrans Settlement Order ${orderNumber}`,
                },
              });
            }
          }
        } else if (orderStatus === "CANCELLED" && order.status !== "CANCELLED") {
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
                  reason: `Midtrans Expired/Cancelled Order ${orderNumber}`,
                },
              });
            }
          }
          if (order.table_id) {
            await syncDbTableSessionLifecycle(tx, order.table_id);
          }
        }
      }, { maxWait: 10000, timeout: 20000 });

      safeRevalidate(`/orders/${orderNumber}`);
      safeRevalidate("/checkout");
      safeRevalidate("/cashier");
      return { success: true, paymentStatus, orderStatus };
    }
  } catch (err) {
    console.warn("[Midtrans] Fallback to memory for payment update:", err);
  }

  // 2. Fallback memory store
  const fallback = memoryOrders.get(orderNumber);
  if (fallback && fallback.payment) {
    const mem = getMemoryStore();
    if (paymentStatus === "PAID" && fallback.payment.status !== "PAID") {
      for (const item of fallback.items) {
        const prod = item.product_id
          ? mem.products.get(item.product_id)
          : Array.from(mem.products.values()).find((p) => p.name === item.product_name_snapshot);
        const st = prod ? mem.stocks.get(prod.id) : undefined;
        if (prod && st) {
          const resBefore = st.reserved_qty;
          st.reserved_qty = Math.max(0, resBefore - item.quantity);
          st.updated_at = new Date();
          mem.movements.unshift({
            id: memoryId("mov"),
            product_id: prod.id,
            actor_id: null,
            actor_name: fallback.customer_name,
            movement_type: "SALE_DEDUCTION",
            qty_change: -item.quantity,
            available_before: st.available_qty,
            available_after: st.available_qty,
            reserved_before: resBefore,
            reserved_after: st.reserved_qty,
            reason: `Midtrans settlement order ${orderNumber}`,
            created_at: new Date(),
          });
        }
      }
    } else if (
      orderStatus === "CANCELLED" &&
      fallback.status !== "CANCELLED" &&
      fallback.payment.status !== "PAID"
    ) {
      for (const item of fallback.items) {
        const prod = item.product_id
          ? mem.products.get(item.product_id)
          : Array.from(mem.products.values()).find((p) => p.name === item.product_name_snapshot);
        const st = prod ? mem.stocks.get(prod.id) : undefined;
        if (prod && st) {
          const availBefore = st.available_qty;
          const resBefore = st.reserved_qty;
          st.available_qty = availBefore + item.quantity;
          st.reserved_qty = Math.max(0, resBefore - item.quantity);
          st.updated_at = new Date();
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
            reason: `Midtrans Expired/Cancelled Order ${orderNumber}`,
            created_at: new Date(),
          });
        }
      }
    }
    fallback.payment.status = paymentStatus;
    if (paymentStatus === "PAID") {
      fallback.payment.amount_paid = fallback.total_amount;
      fallback.payment.paid_at = new Date();
    }
    if (fallback.status === "PENDING") {
      fallback.status = orderStatus;
    }
    if (orderStatus === "CANCELLED" && fallback.table?.table_number) {
      const targetTable = findMemoryTableByNumber(fallback.table.table_number);
      if (targetTable) {
        syncMemoryTableSessionLifecycle(targetTable.id);
      }
    }
    memoryOrders.set(orderNumber, fallback);
    safeRevalidate(`/orders/${orderNumber}`);
    safeRevalidate("/checkout");
    safeRevalidate("/cashier");
    return { success: true, paymentStatus, orderStatus };
  }

  return { success: false, error: "Pesanan tidak ditemukan." };
}

/**
 * Cek status pembayaran ke Midtrans Core API secara On-Demand (Realtime)
 */
export async function checkMidtransStatusAction(orderNumber: string) {
  try {
    const gatewayOrderId = await resolveLatestGatewayOrderId(orderNumber);
    let queriedOrderId = gatewayOrderId;
    let statusData = await checkMidtransStatus(gatewayOrderId);

    if (!statusData && gatewayOrderId !== orderNumber) {
      statusData = await checkMidtransStatus(orderNumber);
      if (statusData) queriedOrderId = orderNumber;
    }

    if (statusData && statusData.transaction_status) {
      const updateResult = await applyMidtransPaymentUpdate(orderNumber, {
        transaction_status: statusData.transaction_status,
        fraud_status: statusData.fraud_status,
        payment_type: statusData.payment_type,
        gross_amount: statusData.gross_amount,
        transaction_id: statusData.transaction_id,
        gateway_order_id: statusData.order_id || queriedOrderId,
        signature_verified: true,
        raw_payload: statusData as unknown as Record<string, unknown>,
      });

      return {
        success: true,
        midtransStatus: statusData.transaction_status,
        paymentType: statusData.payment_type,
        paymentStatus: updateResult.paymentStatus,
        orderStatus: updateResult.orderStatus,
        message: `Status Midtrans: ${statusData.transaction_status} (${updateResult.paymentStatus})`,
      };
    }

    // Jika API belum mengembalikan data atau masih dalam simulasi/dummy
    return {
      success: true,
      midtransStatus: "pending",
      paymentStatus: "UNPAID",
      orderStatus: "PENDING",
      message: "Menunggu transaksi diproses atau diselesaikan di Midtrans.",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengecek status pembayaran Midtrans.",
    };
  }
}

// Simulasi Pembayaran Sukses (Testing / Webhook Simulator)
export async function simulatePaymentSuccess(orderNumber: string) {
  await cleanupExpiredOrders().catch(() => {});
  try {
    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
      include: { payment: true, items: true },
    });

    if (order && order.payment) {
      if (order.status === "CANCELLED" || (order.expires_at && new Date(order.expires_at) < new Date())) {
        return {
          success: false,
          error: "Pesanan sudah kedaluwarsa atau dibatalkan dan tidak dapat dibayar.",
        };
      }
      await withDistributedTransaction(
        async (tx: any) => {
        // Update payment to PAID
        await tx.payment.update({
          where: { id: order.payment!.id },
          data: {
            status: "PAID",
            amount_paid: order.total_amount,
            paid_at: new Date(),
          },
        });

        // Update order status to CONFIRMED
        await tx.order.update({
          where: { id: order.id },
          data: { status: "CONFIRMED" },
        });

        // Commit stock reservation
        for (const item of order.items) {
          const stock = await tx.productStock.findUnique({
            where: { product_id: item.product_id },
          });
          if (stock) {
            await tx.productStock.update({
              where: { product_id: item.product_id },
              data: {
                reserved_qty: Math.max(0, stock.reserved_qty - item.quantity),
              },
            });

            await tx.stockMovement.create({
              data: {
                product_id: item.product_id,
                order_id: order.id,
                movement_type: "SALE_DEDUCTION",
                qty_change: 0,
                available_before: stock.available_qty,
                available_after: stock.available_qty,
                reserved_before: stock.reserved_qty,
                reserved_after: Math.max(0, stock.reserved_qty - item.quantity),
                reason: "Konfirmasi pembayaran lunas (PAID)",
              },
            });
          }
        }
      }, { maxWait: 10000, timeout: 20000 });

      safeRevalidate(`/orders/${orderNumber}`);
      return { success: true };
    }
  } catch (err: unknown) {
    console.warn(
      "Update payment di fallback memory:",
      err instanceof Error ? err.message : String(err),
    );
  }

  const fallback = memoryOrders.get(orderNumber);
  if (fallback && fallback.payment) {
    if (
      fallback.status === "CANCELLED" ||
      (fallback.expires_at && new Date(fallback.expires_at) < new Date())
    ) {
      return {
        success: false,
        error: "Pesanan sudah kedaluwarsa atau dibatalkan dan tidak dapat dibayar.",
      };
    }
    if (fallback.payment.status !== "PAID") {
      const mem = getMemoryStore();
      for (const item of fallback.items) {
        const prod = item.product_id
          ? mem.products.get(item.product_id)
          : Array.from(mem.products.values()).find((p) => p.name === item.product_name_snapshot);
        const st = prod ? mem.stocks.get(prod.id) : undefined;
        if (prod && st) {
          const resBefore = st.reserved_qty;
          st.reserved_qty = Math.max(0, resBefore - item.quantity);
          st.updated_at = new Date();
          mem.movements.unshift({
            id: memoryId("mov"),
            product_id: prod.id,
            actor_id: null,
            actor_name: fallback.customer_name,
            movement_type: "SALE_DEDUCTION",
            qty_change: -item.quantity,
            available_before: st.available_qty,
            available_after: st.available_qty,
            reserved_before: resBefore,
            reserved_after: st.reserved_qty,
            reason: `Pembayaran order ${orderNumber}`,
            created_at: new Date(),
          });
        }
      }
    }
    fallback.payment.status = "PAID";
    fallback.payment.amount_paid = fallback.total_amount;
    fallback.payment.paid_at = new Date();
    fallback.status = "CONFIRMED";
    memoryOrders.set(orderNumber, fallback);
    safeRevalidate(`/orders/${orderNumber}`);
    return { success: true };
  }

  return { success: false, error: "Pesanan gagal diperbarui." };
}

// Simulasi Pergantian Status Dapur / Kasir
export async function simulateStatusUpdate(orderNumber: string, nextStatus: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
    });

    if (order) {
      await withDistributedTransaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: nextStatus },
        });
        if (nextStatus === "CANCELLED" && order.table_id) {
          await syncDbTableSessionLifecycle(tx, order.table_id);
        }
      });
      safeRevalidate(`/orders/${orderNumber}`);
      return { success: true };
    }
  } catch (err: unknown) {
    console.warn(
      "Update status di fallback memory:",
      err instanceof Error ? err.message : String(err),
    );
  }

  const fallback = memoryOrders.get(orderNumber);
  if (fallback) {
    if (
      nextStatus === "CANCELLED" &&
      fallback.status !== "CANCELLED" &&
      fallback.payment?.status !== "PAID"
    ) {
      const mem = getMemoryStore();
      for (const item of fallback.items) {
        const prod = item.product_id
          ? mem.products.get(item.product_id)
          : Array.from(mem.products.values()).find((p) => p.name === item.product_name_snapshot);
        const st = prod ? mem.stocks.get(prod.id) : undefined;
        if (prod && st) {
          const availBefore = st.available_qty;
          const resBefore = st.reserved_qty;
          st.available_qty = availBefore + item.quantity;
          st.reserved_qty = Math.max(0, resBefore - item.quantity);
          st.updated_at = new Date();
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
            reason: `Batal order ${orderNumber}`,
            created_at: new Date(),
          });
        }
      }
    }
    fallback.status = nextStatus;
    if (nextStatus === "CANCELLED" && fallback.table?.table_number) {
      const targetTable = findMemoryTableByNumber(fallback.table.table_number);
      if (targetTable) {
        syncMemoryTableSessionLifecycle(targetTable.id);
      }
    }
    memoryOrders.set(orderNumber, fallback);
    safeRevalidate(`/orders/${orderNumber}`);
    return { success: true };
  }

  return { success: false, error: "Gagal memperbarui status." };
}

"use server";

import { getMemoryStore, memoryId } from "@/lib/admin/memory-store";
import { prisma } from "@/lib/prisma";
import { safeRevalidate, memoryOrders } from "./helpers";
import {
  createSnapTransaction,
  checkMidtransStatus,
  mapMidtransStatusToInternal,
  type MidtransStatusResponse,
} from "@/lib/midtrans";

/**
 * Buat Snap Token & Redirect URL untuk pembayaran Midtrans
 */
export async function createMidtransSnapAction(orderNumber: string) {
  try {
    let customerName = "Pelanggan Warkop";
    let customerPhone = "-";
    let grossAmount = 0;
    let items: { id: string; price: number; quantity: number; name: string }[] = [];

    // Cek di Prisma Database
    try {
      const order = await prisma.order.findUnique({
        where: { order_number: orderNumber },
        include: { items: true, payment: true },
      });

      if (order) {
        customerName = order.customer_name;
        customerPhone = order.customer_phone || "-";
        grossAmount = Number(order.total_amount);
        items = order.items.map((it: any) => ({
          id: it.product_id || it.id,
          name: it.product_name_snapshot,
          price: Number(it.unit_price_snapshot),
          quantity: it.quantity,
        }));
      }
    } catch {
      // Fallback ke memory store
    }

    // Jika belum ketemu dari DB, cari di fallback memory
    if (grossAmount === 0) {
      const fallback = memoryOrders.get(orderNumber);
      if (fallback) {
        customerName = fallback.customer_name;
        customerPhone = fallback.customer_phone || "-";
        grossAmount = Number(fallback.total_amount);
        items = fallback.items.map((it) => ({
          id: it.product_id || it.id,
          name: it.product_name_snapshot,
          price: Number(it.unit_price_snapshot),
          quantity: it.quantity,
        }));
      }
    }

    if (grossAmount <= 0) {
      return {
        success: false,
        error: `Pesanan ${orderNumber} tidak ditemukan atau nominal tidak valid.`,
      };
    }

    const snapResult = await createSnapTransaction({
      orderNumber,
      customerName,
      customerPhone,
      grossAmount,
      items,
    });

    return {
      success: true,
      token: snapResult.token,
      redirectUrl: snapResult.redirectUrl,
      isSimulation: snapResult.isSimulation ?? false,
    };
  } catch (err) {
    console.error(`[Midtrans] Gagal membuat Snap Action untuk ${orderNumber}:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghubungi Midtrans.",
    };
  }
}

/**
 * Terapkan pembaruan status pembayaran Midtrans ke Database / Memory
 */
export async function applyMidtransPaymentUpdate(
  orderNumber: string,
  payload: {
    transaction_status: string;
    fraud_status?: string;
    payment_type?: string;
    gross_amount?: string | number;
    transaction_id?: string;
    signature_verified?: boolean;
    raw_payload?: Record<string, unknown>;
  }
) {
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

      await prisma.$transaction(async (tx: any) => {
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
              gateway_order_id: orderNumber,
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

        // Update status order
        if (order.status !== "COMPLETED") {
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
        }
      });

      safeRevalidate(`/orders/${orderNumber}`);
      return { success: true, paymentStatus, orderStatus };
    }
  } catch (err) {
    console.warn("[Midtrans] Fallback to memory for payment update:", err);
  }

  // 2. Fallback memory store
  const fallback = memoryOrders.get(orderNumber);
  if (fallback && fallback.payment) {
    if (paymentStatus === "PAID" && fallback.payment.status !== "PAID") {
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
            reason: `Midtrans settlement order ${orderNumber}`,
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
    fallback.status = orderStatus;
    memoryOrders.set(orderNumber, fallback);
    safeRevalidate(`/orders/${orderNumber}`);
    return { success: true, paymentStatus, orderStatus };
  }

  return { success: false, error: "Pesanan tidak ditemukan." };
}

/**
 * Cek status pembayaran ke Midtrans Core API secara On-Demand (Realtime)
 */
export async function checkMidtransStatusAction(orderNumber: string) {
  try {
    const statusData = await checkMidtransStatus(orderNumber);

    if (statusData && statusData.transaction_status) {
      const updateResult = await applyMidtransPaymentUpdate(orderNumber, {
        transaction_status: statusData.transaction_status,
        fraud_status: statusData.fraud_status,
        payment_type: statusData.payment_type,
        gross_amount: statusData.gross_amount,
        transaction_id: statusData.transaction_id,
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
  try {
    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
      include: { payment: true, items: true },
    });

    if (order && order.payment) {
      await prisma.$transaction(async (tx: any) => {
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
      });

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
      await prisma.order.update({
        where: { id: order.id },
        data: { status: nextStatus },
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
    memoryOrders.set(orderNumber, fallback);
    safeRevalidate(`/orders/${orderNumber}`);
    return { success: true };
  }

  return { success: false, error: "Gagal memperbarui status." };
}

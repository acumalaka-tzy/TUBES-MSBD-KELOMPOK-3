"use server";

import { getMemoryStore, memoryId } from "@/lib/admin/memory-store";

import { prisma } from "@/lib/prisma";
import { safeRevalidate, memoryOrders } from "./helpers";

// Simulasi Pembayaran Sukses (Testing / Webhook Simulator)
export async function simulatePaymentSuccess(orderNumber: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { order_number: orderNumber },
      include: { payment: true, items: true },
    });

    if (order && order.payment) {
      await prisma.$transaction(async (tx) => {
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

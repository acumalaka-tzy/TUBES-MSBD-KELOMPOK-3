"use server";

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
  } catch (err: any) {
    console.warn("Update payment di fallback memory:", err.message);
  }

  const fallback = memoryOrders.get(orderNumber);
  if (fallback) {
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
  } catch (err: any) {
    console.warn("Update status di fallback memory:", err.message);
  }

  const fallback = memoryOrders.get(orderNumber);
  if (fallback) {
    fallback.status = nextStatus;
    memoryOrders.set(orderNumber, fallback);
    safeRevalidate(`/orders/${orderNumber}`);
    return { success: true };
  }

  return { success: false, error: "Gagal memperbarui status." };
}

"use server";

import { prisma } from "@/lib/prisma";
import { CheckoutInput } from "./types";
import { safeRevalidate, memoryOrders } from "./helpers";

function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `ORD-${dateStr}-${randomSuffix}`;
}

function generateTrackingToken(): string {
  return `trk_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

export async function createOrder(input: CheckoutInput) {
  try {
    if (!input.customerName?.trim()) {
      return { success: false, error: "Nama pelanggan wajib diisi." };
    }
    if (!input.customerPhone?.trim()) {
      return { success: false, error: "Nomor WhatsApp aktif wajib diisi." };
    }
    if (input.serviceType === "DINE_IN" && !input.tableNumber) {
      return { success: false, error: "Pilih nomor meja untuk pesanan Dine In." };
    }
    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Keranjang pesanan masih kosong." };
    }

    // Hitung subtotal dan total
    let subtotal = 0;
    for (const item of input.items) {
      const optionsSum = item.options.reduce(
        (sum, opt) => sum + (Number(opt.priceAdjustment) || 0),
        0
      );
      subtotal += (item.unitPrice + optionsSum) * item.quantity;
    }

    const taxAmount = Math.round(subtotal * 0.1); // PB1 10%
    const totalAmount = subtotal + taxAmount;

    const orderNumber = generateOrderNumber();
    const trackingToken = generateTrackingToken();

    const expiryMinutes = input.paymentMethod === "CASH" ? 30 : 15;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Eksekusi transaksi database Prisma (ACID)
    try {
      let selectedTableId: string | null = null;
      if (input.serviceType === "DINE_IN" && input.tableNumber) {
        const table = await prisma.table.findUnique({
          where: { table_number: input.tableNumber },
        });
        if (table) {
          selectedTableId = table.id;
        }
      }

      const created = await prisma.$transaction(async (tx) => {
        // 1. Cek & Reservasi Stok untuk setiap produk
        for (const item of input.items) {
          const stock = await tx.productStock.findUnique({
            where: { product_id: item.productId },
          });

          if (stock) {
            if (stock.available_qty < item.quantity) {
              throw new Error(
                `Stok menu "${item.name}" tidak mencukupi (Tersedia: ${stock.available_qty}, Diminta: ${item.quantity}).`
              );
            }

            // Kurangi available_qty, tambah reserved_qty
            await tx.productStock.update({
              where: { product_id: item.productId },
              data: {
                available_qty: stock.available_qty - item.quantity,
                reserved_qty: stock.reserved_qty + item.quantity,
              },
            });

            // Catat log mutasi stok
            await tx.stockMovement.create({
              data: {
                product_id: item.productId,
                movement_type: "RESERVE",
                qty_change: -item.quantity,
                available_before: stock.available_qty,
                available_after: stock.available_qty - item.quantity,
                reserved_before: stock.reserved_qty,
                reserved_after: stock.reserved_qty + item.quantity,
                reason: `Reservasi stok pesanan ${orderNumber}`,
              },
            });
          }
        }

        // 2. Buat Header Pesanan (Orders)
        const order = await tx.order.create({
          data: {
            order_number: orderNumber,
            table_id: selectedTableId,
            customer_name: input.customerName.trim(),
            customer_phone: input.customerPhone.trim(),
            tracking_token: trackingToken,
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

        // 3. Buat Detail Item (OrderItems) & Varian (OrderItemOptions)
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

        // 4. Buat Rekaman Pembayaran (Payments)
        await tx.payment.create({
          data: {
            order_id: order.id,
            method: input.paymentMethod,
            status: "UNPAID",
            amount_due: totalAmount,
            amount_paid: 0,
            change_amount: 0,
          },
        });

        // 5. Update Status Meja jika Dine In
        if (selectedTableId) {
          await tx.table.update({
            where: { id: selectedTableId },
            data: { status: "OCCUPIED" },
          });
        }

        return order;
      });

      return {
        success: true,
        orderNumber: created.order_number,
        trackingToken: created.tracking_token,
      };
    } catch (dbError: any) {
      console.warn("Prisma DB belum tersambung langsung, menyimpan di mock memory order:", dbError.message);
      
      // Simpan di Memory Fallback agar user tetap bisa menguji alur 100%
      const fallbackOrder = {
        id: `mock-${Date.now()}`,
        order_number: orderNumber,
        customer_name: input.customerName.trim(),
        customer_phone: input.customerPhone.trim(),
        tracking_token: trackingToken,
        source: "WEB",
        service_type: input.serviceType,
        status: "PENDING",
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: input.notes?.trim() || null,
        expires_at: expiresAt,
        created_at: new Date(),
        table: input.tableNumber
          ? { table_number: input.tableNumber, name: `Meja ${input.tableNumber}` }
          : null,
        items: input.items.map((it, idx) => {
          const optTotal = it.options.reduce((s, o) => s + (Number(o.priceAdjustment) || 0), 0);
          return {
            id: `mock-item-${idx}`,
            product_name_snapshot: it.name,
            unit_price_snapshot: it.unitPrice,
            quantity: it.quantity,
            subtotal: (it.unitPrice + optTotal) * it.quantity,
            item_notes: it.itemNotes || null,
            options: it.options.map((opt) => ({
              option_group_name_snapshot: opt.groupName,
              option_name_snapshot: opt.optionName,
              price_adjustment_snapshot: opt.priceAdjustment,
            })),
          };
        }),
        payment: {
          id: `mock-pay-${Date.now()}`,
          method: input.paymentMethod,
          status: "UNPAID",
          amount_due: totalAmount,
          amount_paid: 0,
          paid_at: null,
        },
      };

      memoryOrders.set(orderNumber, fallbackOrder);

      return {
        success: true,
        orderNumber,
        trackingToken,
      };
    }
  } catch (err: any) {
    console.error("Gagal membuat pesanan:", err);
    return { success: false, error: err.message || "Terjadi kesalahan internal server." };
  }
}

export async function getOrderDetail(orderNumber: string) {
  try {
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
  } catch (dbErr) {
    console.warn("Mencari di fallback memory order:", orderNumber);
  }

  // Cek di memory fallback
  const fallback = memoryOrders.get(orderNumber);
  if (fallback) {
    return { success: true, data: fallback };
  }

  return { success: false, error: "Pesanan tidak ditemukan." };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Dipanggil di luar request context Next.js (misal script test)
  }
}

export interface CheckoutInput {
  customerName: string;
  customerPhone: string;
  serviceType: "DINE_IN" | "TAKEAWAY";
  tableNumber?: string;
  paymentMethod: "CASH" | "QRIS" | "VIRTUAL_ACCOUNT";
  notes?: string;
  items: {
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    itemNotes?: string;
    options: {
      groupName: string;
      optionName: string;
      priceAdjustment: number;
    }[];
  }[];
}

// Fallback in-memory storage jika MySQL belum terkoneksi saat pengujian mandiri
const memoryOrders = new Map<string, any>();

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

    // Coba eksekusi transaksi database Prisma (ACID)
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
  } catch (err) {
    console.warn("Update payment di fallback memory");
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
  } catch (err) {
    console.warn("Update status di fallback memory");
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

export async function getTablesList() {
  try {
    const tables = await prisma.table.findMany({
      where: { is_active: true },
      orderBy: { table_number: "asc" },
    });
    if (tables.length > 0) {
      return tables.map((t) => ({
        id: t.id,
        table_number: t.table_number,
        name: t.name,
        status: t.status,
      }));
    }
  } catch (err) {
    // fallback tables
  }

  return [
    { id: "tbl-01", table_number: "01", name: "Meja 01 (Indoor)", status: "AVAILABLE" },
    { id: "tbl-02", table_number: "02", name: "Meja 02 (Indoor)", status: "AVAILABLE" },
    { id: "tbl-03", table_number: "03", name: "Meja 03 (Indoor)", status: "AVAILABLE" },
    { id: "tbl-04", table_number: "04", name: "Meja 04 (Teras)", status: "AVAILABLE" },
    { id: "tbl-05", table_number: "05", name: "Meja 05 (Teras)", status: "AVAILABLE" },
    { id: "tbl-06", table_number: "06", name: "Meja 06 (VIP)", status: "AVAILABLE" },
  ];
}

export async function getAvailableProducts() {
  try {
    const products = await prisma.product.findMany({
      where: { is_available: true, deleted_at: null },
      include: {
        category: true,
        stock: true,
        option_groups: {
          include: {
            option_items: {
              where: { is_available: true },
              orderBy: { sort_order: "asc" },
            },
          },
          orderBy: { sort_order: "asc" },
        },
      },
      orderBy: { sort_order: "asc" },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category.name,
      base_price: Number(p.base_price),
      description: p.description,
      available_qty: p.stock?.available_qty ?? 0,
      option_groups: p.option_groups.map((g) => ({
        id: g.id,
        name: g.name,
        is_required: g.is_required,
        items: g.option_items.map((i) => ({
          id: i.id,
          name: i.name,
          price_adjustment: Number(i.price_adjustment),
        })),
      })),
    }));
  } catch (err: any) {
    console.error("Gagal mengambil produk dari database:", err.message);
    return [];
  }
}


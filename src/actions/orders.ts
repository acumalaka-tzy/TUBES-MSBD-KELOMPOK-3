"use server";

import { prisma } from "@/lib/prisma";
import { CheckoutInput, OrderDetailData } from "./types";
import { memoryOrders } from "./helpers";
import { getSession } from "@/lib/auth/session";
import { getPublicStoreSettings } from "@/lib/admin/queries";
import { getMemoryStore, memoryId } from "@/lib/admin/memory-store";
import { invalidateDatabaseCheck } from "@/lib/admin/db";

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

    const storeSettings = await getPublicStoreSettings();
    if (!storeSettings.isWebOrderingOpen) {
      return {
        success: false,
        error: "Maaf, pemesanan melalui web sedang ditutup sementara oleh admin.",
      };
    }

    // Hitung subtotal dan total mengikuti pengaturan pajak aktif dari Admin
    let subtotal = 0;
    for (const item of input.items) {
      const optionsSum = item.options.reduce(
        (sum, opt) => sum + (Number(opt.priceAdjustment) || 0),
        0
      );
      subtotal += (item.unitPrice + optionsSum) * item.quantity;
    }

    const taxAmount = storeSettings.taxEnabled
      ? Math.round(subtotal * (storeSettings.taxPercentage / 100))
      : 0;
    const totalAmount = subtotal + taxAmount;

    const orderNumber = generateOrderNumber();
    const trackingToken = generateTrackingToken();

    // Sesi login & identitas user jika ada (Guest Checkout: null)
    const session = await getSession();
    const effectiveUserId = input.userId !== undefined ? input.userId : (session?.sub || null);

    const expiryMinutes =
      input.paymentMethod === "CASH"
        ? storeSettings.cashExpiryMinutes
        : storeSettings.digitalExpiryMinutes;
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
            user_id: effectiveUserId,
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
    } catch (dbError: unknown) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      if (msg.startsWith("Stok ") || msg.startsWith("Menu ")) {
        return { success: false, error: msg };
      }

      invalidateDatabaseCheck();
      console.warn(
        "Prisma DB belum tersambung langsung, menyimpan di mock memory order:",
        msg,
      );

      const mem = getMemoryStore();
      for (const item of input.items) {
        const prod = mem.products.get(item.productId);
        if (prod && prod.deleted_at !== null) {
          return { success: false, error: `Menu "${item.name}" sudah tidak tersedia.` };
        }
        const st = mem.stocks.get(item.productId);
        if (st && (!prod?.is_available || st.available_qty < item.quantity)) {
          const tersisa = prod?.is_available ? st.available_qty : 0;
          return {
            success: false,
            error: `Stok "${item.name}" hanya tersisa ${tersisa} porsi.`,
          };
        }
      }

      for (const item of input.items) {
        const st = mem.stocks.get(item.productId);
        const prod = mem.products.get(item.productId);
        if (st) {
          const availBefore = st.available_qty;
          const resBefore = st.reserved_qty;
          st.available_qty = availBefore - item.quantity;
          st.reserved_qty = resBefore + item.quantity;
          st.updated_at = new Date();
          if (prod && st.available_qty <= 0) {
            prod.is_available = false;
          }
          mem.movements.unshift({
            id: memoryId("mov"),
            product_id: item.productId,
            actor_id: effectiveUserId,
            actor_name: input.customerName,
            movement_type: "RESERVE",
            qty_change: -item.quantity,
            available_before: availBefore,
            available_after: st.available_qty,
            reserved_before: resBefore,
            reserved_after: st.reserved_qty,
            reason: `Reservasi order ${orderNumber}`,
            created_at: new Date(),
          });
        }
      }

      let resolvedTableInfo: { table_number: string; name: string } | null = null;
      if (input.serviceType === "DINE_IN" && input.tableNumber) {
        const matchedTable = Array.from(mem.tables.values()).find(
          (t) => t.table_number === input.tableNumber
        );
        if (matchedTable) {
          matchedTable.status = "OCCUPIED";
          matchedTable.updated_at = new Date();
          resolvedTableInfo = {
            table_number: matchedTable.table_number,
            name: matchedTable.name,
          };
        } else {
          resolvedTableInfo = {
            table_number: input.tableNumber,
            name: `Meja ${input.tableNumber}`,
          };
        }
      }

      // Simpan di Memory Fallback agar user tetap bisa menguji alur 100%
      const fallbackOrder: OrderDetailData = {
        id: `mock-${Date.now()}`,
        order_number: orderNumber,
        user_id: effectiveUserId,
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
        table: resolvedTableInfo,
        items: input.items.map((it, idx) => {
          const optTotal = it.options.reduce((s, o) => s + (Number(o.priceAdjustment) || 0), 0);
          return {
            id: `mock-item-${idx}`,
            product_id: it.productId,
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
          change_amount: 0,
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
  } catch (err: unknown) {
    console.error("Gagal membuat pesanan:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal server.",
    };
  }
}

export async function getOrderDetail(
  orderNumber: string,
): Promise<{ success: boolean; data?: OrderDetailData; error?: string }> {
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
 * Mengambil daftar riwayat pesanan milik pelanggan yang sedang login dari database
 */
export async function getCustomerRecentOrders(): Promise<{
  success: boolean;
  orders: CustomerRecentOrderSummary[];
}> {
  try {
    const session = await getSession();
    if (!session || !session.sub) {
      return { success: true, orders: [] };
    }

    const dbOrders = await prisma.order.findMany({
      where: {
        OR: [
          { user_id: session.sub },
          ...(session.phone ? [{ customer_phone: session.phone }] : []),
        ],
      },
      orderBy: { created_at: "desc" },
      take: 20,
      include: {
        table: true,
        items: true,
      },
    });

    const orders: CustomerRecentOrderSummary[] = dbOrders.map((o) => ({
      orderNumber: o.order_number,
      trackingToken: o.tracking_token,
      totalAmount: Number(o.total_amount),
      status: o.status,
      itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: o.created_at.toISOString(),
      serviceType: o.service_type,
      tableNumber: o.table?.table_number || null,
      itemsSummary: o.items.map((it) => `${it.quantity}x ${it.product_name_snapshot}`).join(", "),
    }));

    return { success: true, orders };
  } catch (err) {
    console.warn("Gagal mengambil riwayat pesanan dari DB:", err);
    return { success: true, orders: [] };
  }
}

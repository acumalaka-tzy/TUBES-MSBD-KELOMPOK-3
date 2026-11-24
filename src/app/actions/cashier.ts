"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withDistributedTransaction } from "@/lib/db/distributed";
import { requireRole } from "@/lib/auth/session";
import type { AuthTokenPayload } from "@/lib/auth/jwt";
import { getUserById } from "@/lib/auth/user-service";
import { recordAuditLog } from "@/lib/admin/audit";
import { errorMessage, invalidateDatabaseCheck, isDatabaseReady, withTimeout } from "@/lib/admin/db";
import { getMemoryStore, memoryId } from "@/lib/admin/memory-store";
import {
  getAdminSettings,
  listAdminCategories,
  listAdminProducts,
  listAdminTables,
} from "@/lib/admin/queries";
import { memoryOrders } from "@/actions/helpers";
import { cleanupExpiredOrders } from "@/actions/orders";
import { generateOrderNumber, generateTrackingToken } from "@/lib/utils";
import {
  findMemoryTableByNumber,
  generateTableSessionToken,
  normalizeTableNumber,
  resolveOrCreateMemoryTableSession,
  syncDbTableSessionLifecycle,
  syncMemoryTableSessionLifecycle,
} from "@/lib/orders/table-session";
import type { OrderDetailData } from "@/actions/types";
import type {
  CashierDashboardPayload,
  CashierMetrics,
  CashierOrder,
  CashierTableInfo,
  PosCreateOrderInput,
} from "@/lib/cashier/types";

const ACTION_TIMEOUT_MS = 15000;

function safeRevalidateAll() {
  for (const p of ["/cashier", "/admin", "/menu", "/checkout", "/"]) {
    try {
      revalidatePath(p);
    } catch {
      // Ignore outside request context
    }
  }
}

async function requireCashierOrAdmin(): Promise<AuthTokenPayload> {
  const session = await requireRole(["CASHIER"]);
  const user = await getUserById(session.sub);
  if (user && !user.isActive) {
    throw new Error("Akun Kasir Anda sedang dinonaktifkan.");
  }
  return session;
}

function mapMemoryOrderToCashierOrder(o: OrderDetailData): CashierOrder {
  const createdDate = o.created_at instanceof Date ? o.created_at : new Date(o.created_at);
  const expiresDate = o.expires_at
    ? o.expires_at instanceof Date
      ? o.expires_at
      : new Date(o.expires_at)
    : null;
  const paidDate = o.payment?.paid_at
    ? o.payment.paid_at instanceof Date
      ? o.payment.paid_at
      : new Date(o.payment.paid_at)
    : null;

  return {
    id: o.id,
    orderNumber: o.order_number,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    trackingToken: o.tracking_token,
    source: o.source || "WEB",
    serviceType: o.service_type || "DINE_IN",
    status: o.status || "PENDING",
    subtotal: Number(o.subtotal),
    taxAmount: Number(o.tax_amount),
    totalAmount: Number(o.total_amount),
    notes: o.notes,
    expiresAt: expiresDate ? expiresDate.toISOString() : null,
    createdAt: createdDate.toISOString(),
    tableNumber: o.table?.table_number ?? null,
    tableName: o.table?.name ?? null,
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.product_id,
      name: it.product_name_snapshot,
      unitPrice: Number(it.unit_price_snapshot),
      quantity: it.quantity,
      subtotal: Number(it.subtotal),
      itemNotes: it.item_notes,
      options: (it.options ?? []).map((opt) => ({
        groupName: opt.option_group_name_snapshot,
        optionName: opt.option_name_snapshot,
        priceAdjustment: Number(opt.price_adjustment_snapshot),
      })),
    })),
    payment: {
      id: o.payment?.id ?? `pay-${o.id}`,
      method: o.payment?.method ?? "CASH",
      status: o.payment?.status ?? "UNPAID",
      amountDue: Number(o.payment?.amount_due ?? o.total_amount),
      amountPaid: Number(o.payment?.amount_paid ?? 0),
      changeAmount: Number(o.payment?.change_amount ?? 0),
      paidAt: paidDate ? paidDate.toISOString() : null,
    },
  };
}

async function listCashierOrders(): Promise<{ orders: CashierOrder[]; source: "database" | "memory" }> {
  if (await isDatabaseReady()) {
    try {
      const rows = await withTimeout(
        prisma.order.findMany({
          take: 120,
          orderBy: { created_at: "desc" },
          include: {
            table: true,
            payment: {
              include: {
                cashier: { select: { name: true } },
              },
            },
            items: {
              include: { options: true },
            },
          },
        }),
        ACTION_TIMEOUT_MS,
      );

      const mapped: CashierOrder[] = rows.map((r) => ({
        id: r.id,
        orderNumber: r.order_number,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        trackingToken: r.tracking_token,
        source: r.source,
        serviceType: r.service_type,
        status: r.status,
        subtotal: Number(r.subtotal),
        taxAmount: Number(r.tax_amount),
        totalAmount: Number(r.total_amount),
        notes: r.notes,
        expiresAt: r.expires_at ? r.expires_at.toISOString() : null,
        createdAt: r.created_at.toISOString(),
        tableNumber: r.table?.table_number ?? null,
        tableName: r.table?.name ?? null,
        items: r.items.map((it) => ({
          id: it.id,
          productId: it.product_id,
          name: it.product_name_snapshot,
          unitPrice: Number(it.unit_price_snapshot),
          quantity: it.quantity,
          subtotal: Number(it.subtotal),
          itemNotes: it.item_notes,
          options: it.options.map((opt) => ({
            groupName: opt.option_group_name_snapshot,
            optionName: opt.option_name_snapshot,
            priceAdjustment: Number(opt.price_adjustment_snapshot),
          })),
        })),
        payment: {
          id: r.payment?.id ?? `pay-${r.id}`,
          method: r.payment?.method ?? "CASH",
          status: r.payment?.status ?? "UNPAID",
          amountDue: Number(r.payment?.amount_due ?? r.total_amount),
          amountPaid: Number(r.payment?.amount_paid ?? 0),
          changeAmount: Number(r.payment?.change_amount ?? 0),
          paidAt: r.payment?.paid_at ? r.payment.paid_at.toISOString() : null,
          cashierName: r.payment?.cashier?.name ?? null,
        },
      }));

      return { orders: mapped, source: "database" };
    } catch (err) {
      console.warn("[cashier:orders] Percobaan 1 gagal, mencoba ulang:", errorMessage(err));
      try {
        const rows = await withTimeout(
          prisma.order.findMany({
            take: 120,
            orderBy: { created_at: "desc" },
            include: {
              table: true,
              payment: {
                include: {
                  cashier: { select: { name: true } },
                },
              },
              items: {
                include: { options: true },
              },
            },
          }),
          ACTION_TIMEOUT_MS,
        );

        const mapped: CashierOrder[] = rows.map((r) => ({
          id: r.id,
          orderNumber: r.order_number,
          customerName: r.customer_name,
          customerPhone: r.customer_phone,
          trackingToken: r.tracking_token,
          source: r.source,
          serviceType: r.service_type,
          status: r.status,
          subtotal: Number(r.subtotal),
          taxAmount: Number(r.tax_amount),
          totalAmount: Number(r.total_amount),
          notes: r.notes,
          expiresAt: r.expires_at ? r.expires_at.toISOString() : null,
          createdAt: r.created_at.toISOString(),
          tableNumber: r.table?.table_number ?? null,
          tableName: r.table?.name ?? null,
          items: r.items.map((it) => ({
            id: it.id,
            productId: it.product_id,
            name: it.product_name_snapshot,
            unitPrice: Number(it.unit_price_snapshot),
            quantity: it.quantity,
            subtotal: Number(it.subtotal),
            itemNotes: it.item_notes,
            options: it.options.map((opt) => ({
              groupName: opt.option_group_name_snapshot,
              optionName: opt.option_name_snapshot,
              priceAdjustment: Number(opt.price_adjustment_snapshot),
            })),
          })),
          payment: {
            id: r.payment?.id ?? `pay-${r.id}`,
            method: r.payment?.method ?? "CASH",
            status: r.payment?.status ?? "UNPAID",
            amountDue: Number(r.payment?.amount_due ?? r.total_amount),
            amountPaid: Number(r.payment?.amount_paid ?? 0),
            changeAmount: Number(r.payment?.change_amount ?? 0),
            paidAt: r.payment?.paid_at ? r.payment.paid_at.toISOString() : null,
            cashierName: r.payment?.cashier?.name ?? null,
          },
        }));

        return { orders: mapped, source: "database" };
      } catch (err2) {
        console.warn("[cashier:orders] Percobaan 2 gagal, fallback ke memoryOrders:", errorMessage(err2));
      }
    }
  }

  const memList = [...memoryOrders.values()]
    .map(mapMemoryOrderToCashierOrder)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { orders: memList, source: "memory" };
}

export async function getCashierDashboardData(): Promise<CashierDashboardPayload> {
  await requireCashierOrAdmin();
  await cleanupExpiredOrders().catch(() => {});

  const [ordersRes, settingsRes, categoriesRes, productsRes, tablesRes] = await Promise.all([
    listCashierOrders(),
    getAdminSettings(),
    listAdminCategories(),
    listAdminProducts(),
    listAdminTables(),
  ]);

  const orders = ordersRes.orders;
  const adminTables = tablesRes.data;

  // Hubungkan pesanan aktif ke masing-masing meja
  const activeStatuses = new Set(["PENDING", "CONFIRMED", "PREPARING", "READY"]);
  const tables: CashierTableInfo[] = adminTables.map((t) => {
    const tableActiveOrders = orders
      .filter(
        (o) =>
          o.serviceType === "DINE_IN" &&
          o.tableNumber === t.tableNumber &&
          activeStatuses.has(o.status),
      )
      .map((o) => ({
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        status: o.status,
        paymentStatus: o.payment.status,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
      }));

    const effectiveStatus: CashierTableInfo["status"] = !t.isActive
      ? "INACTIVE"
      : t.status === "OCCUPIED" || tableActiveOrders.length > 0
        ? "OCCUPIED"
        : "AVAILABLE";

    return {
      id: t.id,
      tableNumber: t.tableNumber,
      name: t.name,
      capacity: t.capacity,
      status: effectiveStatus,
      isActive: t.isActive,
      activeOrders: tableActiveOrders,
    };
  });

  // Hitung ringkasan metrik operasional hari ini (PRD 6.1)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter((o) => new Date(o.createdAt) >= startOfToday);
  const paidToday = todayOrders.filter(
    (o) => o.status !== "CANCELLED" && o.payment.status === "PAID",
  );
  const todayRevenue = paidToday.reduce((sum, o) => sum + o.totalAmount, 0);

  const needActionCount = orders.filter(
    (o) =>
      o.status === "PENDING" ||
      o.status === "CONFIRMED" ||
      (o.status !== "CANCELLED" && o.status !== "COMPLETED" && o.payment.status === "UNPAID"),
  ).length;

  const preparingCount = orders.filter((o) => o.status === "PREPARING").length;
  const readyCount = orders.filter((o) => o.status === "READY").length;
  const unpaidCashCount = orders.filter(
    (o) =>
      o.status !== "CANCELLED" &&
      o.payment.method === "CASH" &&
      o.payment.status === "UNPAID",
  ).length;

  const activeTablesList = tables.filter((t) => t.isActive);
  const occupiedTablesCount = activeTablesList.filter((t) => t.status === "OCCUPIED").length;

  const metrics: CashierMetrics = {
    todayRevenue,
    todayOrdersCount: todayOrders.length,
    paidOrdersCount: paidToday.length,
    needActionCount,
    preparingCount,
    readyCount,
    unpaidCashCount,
    occupiedTablesCount,
    totalActiveTablesCount: activeTablesList.length,
  };

  return {
    dataSource: ordersRes.source,
    settings: settingsRes.data,
    metrics,
    orders,
    tables,
    categories: categoriesRes.data.filter((c) => c.isActive && !c.deletedAt),
    products: productsRes.data.filter((p) => !p.deletedAt),
  };
}

/* ----------------------------------------------------------------------------
 * 1. Konfirmasi Pembayaran Tunai & Kalkulasi Kembalian (PRD 6.4)
 * ------------------------------------------------------------------------- */

export async function confirmCashPaymentAction(input: {
  orderNumber: string;
  amountPaid: number;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  changeAmount?: number;
}> {
  try {
    const staff = await requireCashierOrAdmin();
    const orderNumber = input.orderNumber.trim();
    const amountPaid = Math.round(Number(input.amountPaid) || 0);

    if (await isDatabaseReady()) {
      try {
        const order = await withTimeout(
          prisma.order.findUnique({
            where: { order_number: orderNumber },
            include: { payment: true, items: true },
          }),
          ACTION_TIMEOUT_MS,
        );

        if (order && order.payment) {
          const totalDue = Number(order.total_amount);
          if (amountPaid < totalDue) {
            return {
              success: false,
              error: `Nominal uang diterima kurang dari total tagihan (Kurang Rp ${(totalDue - amountPaid).toLocaleString("id-ID")}).`,
            };
          }
          const changeAmount = amountPaid - totalDue;
          const dbCashierUser = await prisma.user.findUnique({
            where: { id: staff.sub },
            select: { id: true },
          });

          await withDistributedTransaction(async (tx) => {
            await tx.payment.update({
              where: { id: order.payment!.id },
              data: {
                status: "PAID",
                method: "CASH",
                cashier_id: dbCashierUser?.id ?? null,
                amount_paid: amountPaid,
                change_amount: changeAmount,
                paid_at: new Date(),
              },
            });

            const nextOrderStatus = order.status === "PENDING" ? "CONFIRMED" : order.status;
            await tx.order.update({
              where: { id: order.id },
              data: { status: nextOrderStatus },
            });

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
                    actor_id: dbCashierUser?.id ?? null,
                    movement_type: "SALE_DEDUCTION",
                    qty_change: 0,
                    available_before: stock.available_qty,
                    available_after: stock.available_qty,
                    reserved_before: stock.reserved_qty,
                    reserved_after: resAfter,
                    reason: `Pelunasan tunai kasir (${orderNumber})`,
                  },
                });
              }
            }
          });

          await recordAuditLog({
            actorId: staff.sub,
            actorName: staff.name,
            actorRole: staff.role,
            entityName: "payments",
            entityId: order.payment.id,
            action: "CONFIRM_CASH_PAYMENT",
            oldData: { status: order.payment.status, amount_paid: Number(order.payment.amount_paid) },
            newData: { status: "PAID", amount_paid: amountPaid, change_amount: changeAmount },
            reason: `Pembayaran tunai pesanan ${orderNumber} diterima oleh ${staff.name}`,
          });

          safeRevalidateAll();
          safeRevalidateOrder(orderNumber);
          return {
            success: true,
            changeAmount,
            message: `Pembayaran tunai ${orderNumber} lunas. Kembalian: Rp ${changeAmount.toLocaleString("id-ID")}.`,
          };
        }
      } catch (dbErr) {
        invalidateDatabaseCheck();
        console.warn("[cashier:confirmCashPayment] Fallback ke memory:", errorMessage(dbErr));
      }
    }

    // Memory mode
    const fallback = memoryOrders.get(orderNumber);
    if (!fallback || !fallback.payment) {
      return { success: false, error: `Pesanan ${orderNumber} tidak ditemukan.` };
    }

    const totalDue = Number(fallback.total_amount);
    if (amountPaid < totalDue) {
      return {
        success: false,
        error: `Nominal uang diterima kurang dari total tagihan (Kurang Rp ${(totalDue - amountPaid).toLocaleString("id-ID")}).`,
      };
    }

    const changeAmount = amountPaid - totalDue;
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
            actor_id: staff.sub,
            actor_name: staff.name,
            movement_type: "SALE_DEDUCTION",
            qty_change: -item.quantity,
            available_before: st.available_qty,
            available_after: st.available_qty,
            reserved_before: resBefore,
            reserved_after: st.reserved_qty,
            reason: `Pelunasan tunai kasir (${orderNumber})`,
            created_at: new Date(),
          });
        }
      }
    }

    fallback.payment.status = "PAID";
    fallback.payment.method = "CASH";
    fallback.payment.amount_paid = amountPaid;
    fallback.payment.change_amount = changeAmount;
    fallback.payment.paid_at = new Date();
    if (fallback.status === "PENDING") {
      fallback.status = "CONFIRMED";
    }
    memoryOrders.set(orderNumber, fallback);

    await recordAuditLog({
      actorId: staff.sub,
      actorName: staff.name,
      actorRole: staff.role,
      entityName: "payments",
      entityId: fallback.payment.id,
      action: "CONFIRM_CASH_PAYMENT",
      oldData: { status: "UNPAID" },
      newData: { status: "PAID", amount_paid: amountPaid, change_amount: changeAmount },
      reason: `Pembayaran tunai pesanan ${orderNumber} diterima oleh ${staff.name}`,
    });

    safeRevalidateAll();
    safeRevalidateOrder(orderNumber);

    return {
      success: true,
      changeAmount,
      message: `Pembayaran tunai ${orderNumber} lunas. Kembalian: Rp ${changeAmount.toLocaleString("id-ID")}.`,
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal memproses pembayaran tunai.") };
  }
}

function safeRevalidateOrder(orderNumber: string) {
  try {
    revalidatePath(`/orders/${orderNumber}`);
  } catch {
    // ignore
  }
}

/* ----------------------------------------------------------------------------
 * 2. Update Status Pesanan Cepat (1-2 Klik) & Manajemen Stok/Meja (PRD 6.2)
 * ------------------------------------------------------------------------- */

const VALID_ORDER_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);

export async function updateOrderStatusCashierAction(input: {
  orderNumber: string;
  nextStatus: string;
  releaseTable?: boolean;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const staff = await requireCashierOrAdmin();
    const orderNumber = input.orderNumber.trim();
    const nextStatus = input.nextStatus.trim().toUpperCase();

    if (!VALID_ORDER_STATUSES.has(nextStatus)) {
      return { success: false, error: "Status pesanan tidak valid." };
    }

    if (await isDatabaseReady()) {
      try {
        const order = await withTimeout(
          prisma.order.findUnique({
            where: { order_number: orderNumber },
            include: { payment: true, items: true, table: true },
          }),
          ACTION_TIMEOUT_MS,
        );

        if (order) {
          const prevStatus = order.status;
          const dbActor = await prisma.user.findUnique({
            where: { id: staff.sub },
            select: { id: true },
          });

          await withDistributedTransaction(async (tx) => {
            // Jika dibatalkan dan belum dibayar, kembalikan stok reservasi (RELEASE_RESERVE)
            if (
              nextStatus === "CANCELLED" &&
              prevStatus !== "CANCELLED" &&
              order.payment?.status !== "PAID"
            ) {
              for (const item of order.items) {
                const stock = await tx.productStock.findUnique({
                  where: { product_id: item.product_id },
                });
                if (stock) {
                  const availAfter = stock.available_qty + item.quantity;
                  const resAfter = Math.max(0, stock.reserved_qty - item.quantity);
                  await tx.productStock.update({
                    where: { product_id: item.product_id },
                    data: {
                      available_qty: availAfter,
                      reserved_qty: resAfter,
                    },
                  });
                  await tx.product.update({
                    where: { id: item.product_id },
                    data: { is_available: availAfter > 0 },
                  });
                  await tx.stockMovement.create({
                    data: {
                      product_id: item.product_id,
                      order_id: order.id,
                      actor_id: dbActor?.id ?? null,
                      movement_type: "RELEASE_RESERVE",
                      qty_change: item.quantity,
                      available_before: stock.available_qty,
                      available_after: availAfter,
                      reserved_before: stock.reserved_qty,
                      reserved_after: resAfter,
                      reason: `Pembatalan pesanan ${orderNumber} oleh kasir`,
                    },
                  });
                }
              }
            }

            await tx.order.update({
              where: { id: order.id },
              data: { status: nextStatus },
            });

            // Sinkronkan sesi meja: hanya tutup sesi & kosongkan meja bila seluruh bill pada sesi selesai/batal
            if (
              order.table_id &&
              (input.releaseTable || nextStatus === "COMPLETED" || nextStatus === "CANCELLED")
            ) {
              await syncDbTableSessionLifecycle(tx, order.table_id, {
                closeIfAllCompleted: Boolean(input.releaseTable && nextStatus === "COMPLETED"),
              });
            }
          });

          await recordAuditLog({
            actorId: staff.sub,
            actorName: staff.name,
            actorRole: staff.role,
            entityName: "orders",
            entityId: order.id,
            action: `UPDATE_ORDER_STATUS_${nextStatus}`,
            oldData: { order_number: orderNumber, status: prevStatus },
            newData: { order_number: orderNumber, status: nextStatus },
          });

          safeRevalidateAll();
          safeRevalidateOrder(orderNumber);
          return {
            success: true,
            message: `Status pesanan ${orderNumber} diperbarui menjadi ${nextStatus}.`,
          };
        }
      } catch (dbErr) {
        invalidateDatabaseCheck();
        console.warn("[cashier:updateStatus] Fallback ke memory:", errorMessage(dbErr));
      }
    }

    // Memory mode
    const fallback = memoryOrders.get(orderNumber);
    if (!fallback) {
      return { success: false, error: `Pesanan ${orderNumber} tidak ditemukan.` };
    }

    const prevStatus = fallback.status;
    const mem = getMemoryStore();

    if (
      nextStatus === "CANCELLED" &&
      prevStatus !== "CANCELLED" &&
      fallback.payment?.status !== "PAID"
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
            actor_id: staff.sub,
            actor_name: staff.name,
            movement_type: "RELEASE_RESERVE",
            qty_change: item.quantity,
            available_before: availBefore,
            available_after: st.available_qty,
            reserved_before: resBefore,
            reserved_after: st.reserved_qty,
            reason: `Pembatalan pesanan ${orderNumber} oleh kasir`,
            created_at: new Date(),
          });
        }
      }
    }

    fallback.status = nextStatus;
    memoryOrders.set(orderNumber, fallback);

    // Sinkronkan sesi meja memori: jangan kosongkan meja jika masih ada bill aktif / belum lunas dalam sesi
    if (
      fallback.table?.table_number &&
      (input.releaseTable || nextStatus === "COMPLETED" || nextStatus === "CANCELLED")
    ) {
      const tbl = findMemoryTableByNumber(fallback.table.table_number);
      if (tbl) {
        syncMemoryTableSessionLifecycle(tbl.id, {
          closeIfAllCompleted: Boolean(input.releaseTable && nextStatus === "COMPLETED"),
        });
      }
    }

    await recordAuditLog({
      actorId: staff.sub,
      actorName: staff.name,
      actorRole: staff.role,
      entityName: "orders",
      entityId: fallback.id,
      action: `UPDATE_ORDER_STATUS_${nextStatus}`,
      oldData: { order_number: orderNumber, status: prevStatus },
      newData: { order_number: orderNumber, status: nextStatus },
    });

    safeRevalidateAll();
    safeRevalidateOrder(orderNumber);

    return {
      success: true,
      message: `Status pesanan ${orderNumber} diperbarui menjadi ${nextStatus}.`,
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal memperbarui status pesanan.") };
  }
}

/* ----------------------------------------------------------------------------
 * 3. Buat Pesanan Manual POS Kasir (Split-Screen POS) (PRD 6.3 & 8.1)
 * ------------------------------------------------------------------------- */

export async function createPosOrderAction(input: PosCreateOrderInput): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  order?: CashierOrder;
}> {
  try {
    const staff = await requireCashierOrAdmin();
    await cleanupExpiredOrders().catch(() => {});

    const customerName = input.customerName?.trim() || "Pelanggan Kasir";
    const customerPhone = input.customerPhone?.trim() || "-";
    const serviceType = input.serviceType === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN";
    const tableNumber = serviceType === "DINE_IN" ? input.tableNumber?.trim() : undefined;

    if (serviceType === "DINE_IN" && !tableNumber) {
      return { success: false, error: "Pilih nomor meja untuk pesanan Dine In." };
    }
    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Keranjang POS masih kosong." };
    }

    const { data: settings } = await getAdminSettings();

    let subtotal = 0;
    for (const item of input.items) {
      const optSum = item.options.reduce((s, o) => s + (Number(o.priceAdjustment) || 0), 0);
      subtotal += (item.unitPrice + optSum) * item.quantity;
    }

    const taxAmount = 0;
    const totalAmount = subtotal;

    const isCashImmediate = input.paymentMethod === "CASH";
    const amountPaid = isCashImmediate
      ? Math.round(Number(input.amountPaid ?? totalAmount))
      : 0;

    if (isCashImmediate && amountPaid < totalAmount) {
      return {
        success: false,
        error: `Nominal bayar tunai kurang dari total tagihan (${totalAmount.toLocaleString("id-ID")}).`,
      };
    }

    const changeAmount = isCashImmediate ? amountPaid - totalAmount : 0;
    const orderNumber = generateOrderNumber();
    const trackingToken = generateTrackingToken();
    const initialOrderStatus = isCashImmediate ? "CONFIRMED" : "PENDING";
    const initialPaymentStatus = isCashImmediate ? "PAID" : "UNPAID";
    const now = new Date();

    if (await isDatabaseReady()) {
      try {
        let selectedTable: { id: string; table_number: string; name: string } | null = null;
        if (serviceType === "DINE_IN" && tableNumber) {
          const { raw, clean, padded } = normalizeTableNumber(tableNumber);
          const t = await prisma.table.findFirst({
            where: {
              OR: [
                { table_number: raw },
                { table_number: clean },
                { table_number: padded },
              ],
            },
          });
          if (t) {
            if (!t.is_active || t.status === "INACTIVE") {
              return { success: false, error: `Meja ${tableNumber} sedang nonaktif.` };
            }
            selectedTable = { id: t.id, table_number: t.table_number, name: t.name };
          }
        }

        const dbActor = await prisma.user.findUnique({
          where: { id: staff.sub },
          select: { id: true },
        });

        const createdOrder = await withDistributedTransaction(async (tx) => {
          let resolvedSessionId: string | null = null;
          if (selectedTable) {
            const activeSess = await tx.tableSession.findFirst({
              where: { table_id: selectedTable.id, status: "ACTIVE" },
              orderBy: { opened_at: "desc" },
            });
            if (activeSess) {
              resolvedSessionId = activeSess.id;
            } else {
              const newSess = await tx.tableSession.create({
                data: {
                  table_id: selectedTable.id,
                  session_token: generateTableSessionToken(selectedTable.table_number),
                  owner_phone: customerPhone !== "-" ? customerPhone : null,
                  owner_name: customerName,
                  status: "ACTIVE",
                },
              });
              resolvedSessionId = newSess.id;
            }
          }

          for (const item of input.items) {
            const stock = await tx.productStock.findUnique({
              where: { product_id: item.productId },
            });
            if (stock) {
              if (stock.available_qty < item.quantity) {
                throw new Error(
                  `Stok menu "${item.name}" tidak mencukupi (Tersedia: ${stock.available_qty}, Diminta: ${item.quantity}).`,
                );
              }
              const availAfter = stock.available_qty - item.quantity;
              const resAfter = isCashImmediate
                ? stock.reserved_qty
                : stock.reserved_qty + item.quantity;

              await tx.productStock.update({
                where: { product_id: item.productId },
                data: {
                  available_qty: availAfter,
                  reserved_qty: resAfter,
                },
              });

              await tx.product.update({
                where: { id: item.productId },
                data: { is_available: availAfter > 0 },
              });

              await tx.stockMovement.create({
                data: {
                  product_id: item.productId,
                  actor_id: dbActor?.id ?? null,
                  movement_type: isCashImmediate ? "SALE_DEDUCTION" : "RESERVE",
                  qty_change: -item.quantity,
                  available_before: stock.available_qty,
                  available_after: availAfter,
                  reserved_before: stock.reserved_qty,
                  reserved_after: resAfter,
                  reason: `Pesanan POS Kasir ${orderNumber}`,
                },
              });
            }
          }

          const order = await tx.order.create({
            data: {
              order_number: orderNumber,
              table_id: selectedTable?.id ?? null,
              table_session_id: resolvedSessionId,
              customer_name: customerName,
              customer_phone: customerPhone,
              tracking_token: trackingToken,
              source: "POS",
              service_type: serviceType,
              status: initialOrderStatus,
              subtotal,
              tax_amount: taxAmount,
              total_amount: totalAmount,
              notes: input.notes?.trim() || null,
              expires_at: isCashImmediate ? null : new Date(Date.now() + 15 * 60 * 1000),
            },
          });

          for (const item of input.items) {
            const optSum = item.options.reduce((s, o) => s + (Number(o.priceAdjustment) || 0), 0);
            const itemSubtotal = (item.unitPrice + optSum) * item.quantity;

            const orderItem = await tx.orderItem.create({
              data: {
                order_id: order.id,
                product_id: item.productId,
                product_name_snapshot: item.name,
                unit_price_snapshot: item.unitPrice,
                quantity: item.quantity,
                subtotal: itemSubtotal,
                item_notes: item.itemNotes?.trim() || null,
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

          await tx.payment.create({
            data: {
              order_id: order.id,
              cashier_id: dbActor?.id ?? null,
              method: input.paymentMethod === "CASH" ? "CASH" : "QRIS",
              status: initialPaymentStatus,
              amount_due: totalAmount,
              amount_paid: amountPaid,
              change_amount: changeAmount,
              paid_at: isCashImmediate ? now : null,
            },
          });

          if (selectedTable) {
            await tx.table.update({
              where: { id: selectedTable.id },
              data: { status: "OCCUPIED" },
            });
          }

          return order;
        });

        const cashierOrder: CashierOrder = {
          id: createdOrder.id,
          orderNumber,
          customerName,
          customerPhone,
          trackingToken,
          source: "POS",
          serviceType,
          status: initialOrderStatus,
          subtotal,
          taxAmount,
          totalAmount,
          notes: input.notes?.trim() || null,
          expiresAt: null,
          createdAt: now.toISOString(),
          tableNumber: selectedTable?.table_number ?? tableNumber ?? null,
          tableName: selectedTable?.name ?? (tableNumber ? `Meja ${tableNumber}` : null),
          items: input.items.map((it, idx) => {
            const optSum = it.options.reduce((s, o) => s + (Number(o.priceAdjustment) || 0), 0);
            return {
              id: `pos-item-${idx}`,
              productId: it.productId,
              name: it.name,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              subtotal: (it.unitPrice + optSum) * it.quantity,
              itemNotes: it.itemNotes?.trim() || null,
              options: it.options,
            };
          }),
          payment: {
            id: `pay-${createdOrder.id}`,
            method: input.paymentMethod,
            status: initialPaymentStatus,
            amountDue: totalAmount,
            amountPaid,
            changeAmount,
            paidAt: isCashImmediate ? now.toISOString() : null,
            cashierName: staff.name,
          },
        };

        await recordAuditLog({
          actorId: staff.sub,
          actorName: staff.name,
          actorRole: staff.role,
          entityName: "orders",
          entityId: createdOrder.id,
          action: "CREATE_POS_ORDER",
          oldData: null,
          newData: {
            order_number: orderNumber,
            service_type: serviceType,
            table_number: tableNumber ?? null,
            total_amount: totalAmount,
            payment_status: initialPaymentStatus,
          },
        });

        safeRevalidateAll();
        return {
          success: true,
          message: `Pesanan POS ${orderNumber} berhasil dibuat (${initialPaymentStatus}).`,
          order: cashierOrder,
        };
      } catch (dbErr) {
        const msg = errorMessage(dbErr);
        if (msg.startsWith("Stok menu")) {
          return { success: false, error: msg };
        }
        invalidateDatabaseCheck();
        console.warn("[cashier:createPosOrder] Fallback ke memory:", msg);
      }
    }

    // Memory mode
    const mem = getMemoryStore();
    for (const item of input.items) {
      const prod = mem.products.get(item.productId);
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
        st.reserved_qty = isCashImmediate ? resBefore : resBefore + item.quantity;
        st.updated_at = now;
        if (prod && st.available_qty <= 0) {
          prod.is_available = false;
        }
        mem.movements.unshift({
          id: memoryId("mov"),
          product_id: item.productId,
          actor_id: staff.sub,
          actor_name: staff.name,
          movement_type: isCashImmediate ? "SALE_DEDUCTION" : "RESERVE",
          qty_change: -item.quantity,
          available_before: availBefore,
          available_after: st.available_qty,
          reserved_before: resBefore,
          reserved_after: st.reserved_qty,
          reason: `Pesanan POS Kasir ${orderNumber}`,
          created_at: now,
        });
      }
    }

    let resolvedTable: { table_number: string; name: string } | null = null;
    let resolvedTableSessionId: string | null = null;
    if (serviceType === "DINE_IN" && tableNumber) {
      const tbl = findMemoryTableByNumber(tableNumber);
      if (tbl) {
        if (!tbl.is_active || tbl.status === "INACTIVE") {
          return { success: false, error: `Meja ${tableNumber} sedang nonaktif.` };
        }
        const sessRes = resolveOrCreateMemoryTableSession({
          table: tbl,
          customerPhone,
          customerName,
          allowCashierAttach: true,
        });
        if (!sessRes.ok) {
          return { success: false, error: sessRes.error };
        }
        resolvedTableSessionId = sessRes.session.id;
        resolvedTable = { table_number: tbl.table_number, name: tbl.name };
      } else {
        resolvedTable = { table_number: tableNumber, name: `Meja ${tableNumber}` };
      }
    }

    const memOrder: OrderDetailData = {
      id: `pos-${Date.now()}`,
      order_number: orderNumber,
      user_id: staff.sub,
      table_session_id: resolvedTableSessionId,
      customer_name: customerName,
      customer_phone: customerPhone,
      tracking_token: trackingToken,
      source: "POS",
      service_type: serviceType,
      status: initialOrderStatus,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: input.notes?.trim() || null,
      expires_at: isCashImmediate ? null : new Date(Date.now() + 15 * 60 * 1000),
      created_at: now,
      table: resolvedTable,
      items: input.items.map((it, idx) => {
        const optSum = it.options.reduce((s, o) => s + (Number(o.priceAdjustment) || 0), 0);
        return {
          id: `pos-item-${Date.now()}-${idx}`,
          product_id: it.productId,
          product_name_snapshot: it.name,
          unit_price_snapshot: it.unitPrice,
          quantity: it.quantity,
          subtotal: (it.unitPrice + optSum) * it.quantity,
          item_notes: it.itemNotes?.trim() || null,
          options: it.options.map((o) => ({
            option_group_name_snapshot: o.groupName,
            option_name_snapshot: o.optionName,
            price_adjustment_snapshot: o.priceAdjustment,
          })),
        };
      }),
      payment: {
        id: `pos-pay-${Date.now()}`,
        method: input.paymentMethod,
        status: initialPaymentStatus,
        amount_due: totalAmount,
        amount_paid: amountPaid,
        change_amount: changeAmount,
        paid_at: isCashImmediate ? now : null,
      },
    };

    memoryOrders.set(orderNumber, memOrder);

    await recordAuditLog({
      actorId: staff.sub,
      actorName: staff.name,
      actorRole: staff.role,
      entityName: "orders",
      entityId: memOrder.id,
      action: "CREATE_POS_ORDER",
      oldData: null,
      newData: {
        order_number: orderNumber,
        service_type: serviceType,
        table_number: tableNumber ?? null,
        total_amount: totalAmount,
        payment_status: initialPaymentStatus,
      },
    });

    safeRevalidateAll();
    const mapped = mapMemoryOrderToCashierOrder(memOrder);
    mapped.payment.cashierName = staff.name;

    return {
      success: true,
      message: `Pesanan POS ${orderNumber} berhasil disimpan (${initialPaymentStatus}).`,
      order: mapped,
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal membuat pesanan POS.") };
  }
}

/* ----------------------------------------------------------------------------
 * 4. Pengelolaan Status Meja (Kosongkan Meja / Tandai Terisi) (PRD 6.5)
 * ------------------------------------------------------------------------- */

export async function setTableStatusCashierAction(input: {
  tableNumber: string;
  status: "AVAILABLE" | "OCCUPIED";
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const staff = await requireCashierOrAdmin();
    await cleanupExpiredOrders().catch(() => {});
    const tableNumber = input.tableNumber.trim();
    const nextStatus = input.status;

    if (await isDatabaseReady()) {
      try {
        const tbl = await prisma.table.findUnique({ where: { table_number: tableNumber } });
        if (tbl) {
          let completedOrderNumbers: string[] = [];

          if (nextStatus === "AVAILABLE") {
            const activeOrders = await prisma.order.findMany({
              where: {
                table_id: tbl.id,
                service_type: "DINE_IN",
                status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] },
              },
              include: { payment: true },
            });

            const unpaidOrders = activeOrders.filter((o) => o.payment?.status !== "PAID");
            if (unpaidOrders.length > 0) {
              const listText = unpaidOrders.map((o) => o.order_number).join(", ");
              return {
                success: false,
                error: `Meja ${tableNumber} masih memiliki pesanan belum lunas (${listText}). Selesaikan pembayaran atau batalkan lewat Antrean Pesanan terlebih dahulu.`,
              };
            }

            completedOrderNumbers = activeOrders.map((o) => o.order_number);

            try {
              // Panggil Stored Procedure sp_complete_and_clear_table di MySQL
              await prisma.$executeRawUnsafe(
                `CALL sp_complete_and_clear_table(?, ?)`,
                tbl.id,
                staff.sub
              );
            } catch (spErr) {
              // Fallback ORM transaction bila SP tidak tersedia
              await withDistributedTransaction(async (tx) => {
                if (activeOrders.length > 0) {
                  await tx.order.updateMany({
                    where: { id: { in: activeOrders.map((o) => o.id) } },
                    data: { status: "COMPLETED" },
                  });
                }
                await tx.tableSession.updateMany({
                  where: { table_id: tbl.id, status: "ACTIVE" },
                  data: { status: "CLOSED", closed_at: new Date() },
                });
                await tx.table.update({
                  where: { id: tbl.id },
                  data: { status: "AVAILABLE" },
                });
              });
            }
          } else {
            await prisma.table.update({
              where: { id: tbl.id },
              data: { status: nextStatus },
            });
          }

          await recordAuditLog({
            actorId: staff.sub,
            actorName: staff.name,
            actorRole: staff.role,
            entityName: "tables",
            entityId: tbl.id,
            action: nextStatus === "AVAILABLE" ? "CLEAR_TABLE" : "OCCUPY_TABLE",
            oldData: { table_number: tableNumber, status: tbl.status },
            newData: {
              table_number: tableNumber,
              status: nextStatus,
              completedOrders: completedOrderNumbers,
            },
          });

          safeRevalidateAll();
          for (const ordNo of completedOrderNumbers) {
            safeRevalidateOrder(ordNo);
          }
          return {
            success: true,
            message:
              nextStatus === "AVAILABLE"
                ? completedOrderNumbers.length > 0
                  ? `Meja ${tableNumber} dikosongkan dan ${completedOrderNumbers.length} pesanan lunas diselesaikan.`
                  : `Meja ${tableNumber} telah dikosongkan dan siap digunakan kembali.`
                : `Meja ${tableNumber} ditandai sedang terisi.`,
          };
        }
      } catch (dbErr) {
        invalidateDatabaseCheck();
        console.warn("[cashier:setTableStatus] Fallback ke memory:", errorMessage(dbErr));
      }
    }

    const mem = getMemoryStore();
    const tbl = [...mem.tables.values()].find((t) => t.table_number === tableNumber);
    if (!tbl) {
      return { success: false, error: `Meja ${tableNumber} tidak ditemukan.` };
    }

    const prevStatus = tbl.status;
    let completedOrderNumbers: string[] = [];

    if (nextStatus === "AVAILABLE") {
      const activeOrders = [...memoryOrders.values()].filter(
        (ord) =>
          ord.table?.table_number === tableNumber &&
          ord.service_type === "DINE_IN" &&
          ["PENDING", "CONFIRMED", "PREPARING", "READY"].includes(ord.status),
      );
      const unpaidOrders = activeOrders.filter((ord) => ord.payment?.status !== "PAID");
      if (unpaidOrders.length > 0) {
        const listText = unpaidOrders.map((o) => o.order_number).join(", ");
        return {
          success: false,
          error: `Meja ${tableNumber} masih memiliki pesanan belum lunas (${listText}). Selesaikan pembayaran atau batalkan lewat Antrean Pesanan terlebih dahulu.`,
        };
      }
      for (const ord of activeOrders) {
        ord.status = "COMPLETED";
        completedOrderNumbers.push(ord.order_number);
      }
      for (const sess of mem.tableSessions.values()) {
        if (sess.table_id === tbl.id && sess.status === "ACTIVE") {
          sess.status = "CLOSED";
          sess.closed_at = new Date();
        }
      }
    }

    tbl.status = nextStatus;
    tbl.updated_at = new Date();

    await recordAuditLog({
      actorId: staff.sub,
      actorName: staff.name,
      actorRole: staff.role,
      entityName: "tables",
      entityId: tbl.id,
      action: nextStatus === "AVAILABLE" ? "CLEAR_TABLE" : "OCCUPY_TABLE",
      oldData: { table_number: tableNumber, status: prevStatus },
      newData: { table_number: tableNumber, status: nextStatus },
    });

    safeRevalidateAll();
    return {
      success: true,
      message:
        nextStatus === "AVAILABLE"
          ? `Meja ${tableNumber} telah dikosongkan dan siap digunakan kembali.`
          : `Meja ${tableNumber} ditandai sedang terisi.`,
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Gagal mengubah status meja.") };
  }
}

/* ----------------------------------------------------------------------------
 * 6. Pencatatan Metadata Cetak Struk Termal 58mm / 80mm (Tabel Receipts)
 * ------------------------------------------------------------------------- */

export async function recordReceiptPrintAction(input: {
  orderNumber: string;
  paperSize: "58MM" | "80MM";
}): Promise<{ success: boolean; receiptNumber: string }> {
  const staff = await requireCashierOrAdmin();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = input.orderNumber.split("-").pop() || Math.floor(100 + Math.random() * 900);
  const receiptNumber = `RCP-${dateStr}-${suffix}`;

  if (await isDatabaseReady()) {
    try {
      const order = await prisma.order.findUnique({
        where: { order_number: input.orderNumber },
        include: { payment: true },
      });
      if (order && order.payment) {
        const dbActor = await prisma.user.findUnique({
          where: { id: staff.sub },
          select: { id: true },
        });
        const existing = await prisma.receipt.findUnique({
          where: { receipt_number: receiptNumber },
        });
        if (existing) {
          await prisma.receipt.update({
            where: { id: existing.id },
            data: {
              paper_size: input.paperSize,
              print_count: existing.print_count + 1,
              printed_at: new Date(),
            },
          });
        } else {
          await prisma.receipt.create({
            data: {
              order_id: order.id,
              payment_id: order.payment.id,
              printed_by: dbActor?.id ?? null,
              receipt_number: receiptNumber,
              paper_size: input.paperSize,
              print_count: 1,
            },
          });
        }
      }
    } catch {
      // Ignore DB receipt metadata failure in fallback mode
    }
  }

  return { success: true, receiptNumber };
}

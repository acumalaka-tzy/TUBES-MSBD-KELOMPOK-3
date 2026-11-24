"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireChef } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/admin/audit";
import { isDatabaseReady, withTimeout } from "@/lib/admin/db";
import { memoryOrders } from "@/actions/helpers";

const ACTION_TIMEOUT_MS = 15000;

export interface KitchenQueueItem {
  order_id: string;
  order_number: string;
  source: string;
  service_type: string;
  order_status: "PENDING" | "CONFIRMED" | "PREPARING" | "READY";
  customer_name: string;
  customer_phone: string;
  table_number: string | null;
  table_name: string | null;
  total_amount: number;
  order_notes: string | null;
  payment_method: string | null;
  payment_status: string | null;
  created_at: string;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    notes: string | null;
    options: string[];
  }>;
}

/**
 * Mengambil antrean aktif dapur (Kitchen Display System).
 * Mengintegrasikan VIEW database `vw_active_kitchen_queue`.
 */
export async function getActiveKitchenQueueAction(): Promise<KitchenQueueItem[]> {
  try {
    await requireChef();

    if (await isDatabaseReady()) {
      try {
        // Query langsung dari Database VIEW `vw_active_kitchen_queue`
        const rawQueue = await withTimeout(
          prisma.$queryRaw<any[]>`
            SELECT 
              order_id,
              order_number,
              source,
              service_type,
              order_status,
              customer_name,
              customer_phone,
              table_number,
              table_name,
              total_amount,
              order_notes,
              payment_method,
              payment_status,
              created_at
            FROM vw_active_kitchen_queue
            ORDER BY created_at ASC
          `,
          ACTION_TIMEOUT_MS
        );

        if (!rawQueue || rawQueue.length === 0) {
          return [];
        }

        const orderIds = rawQueue.map((q) => q.order_id);
          const orderItems = await prisma.orderItem.findMany({
            where: { order_id: { in: orderIds } },
            include: {
              product: { select: { name: true } },
              options: true,
            },
          });

          const itemsByOrderId = new Map<string, any[]>();
          for (const item of orderItems) {
            const list = itemsByOrderId.get(item.order_id) || [];
            list.push({
              id: item.id,
              product_name: item.product_name_snapshot || item.product?.name || "Item Menu",
              quantity: item.quantity,
              notes: item.item_notes,
              options: item.options.map((opt) => opt.option_name_snapshot),
            });
            itemsByOrderId.set(item.order_id, list);
          }

          return rawQueue.map((row) => ({
            order_id: row.order_id,
            order_number: row.order_number,
            source: row.source,
            service_type: row.service_type,
            order_status: row.order_status,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            table_number: row.table_number,
            table_name: row.table_name,
            total_amount: Number(row.total_amount),
            order_notes: row.order_notes,
            payment_method: row.payment_method,
            payment_status: row.payment_status,
            created_at: new Date(row.created_at).toISOString(),
            items: itemsByOrderId.get(row.order_id) || [],
          }));
      } catch (err) {
        console.warn("Prisma error querying vw_active_kitchen_queue, falling back to memory:", err);
      }
    }

    // Fallback in-memory
    const activeMemoryOrders = Array.from(memoryOrders.values())
      .filter((o) => ["PENDING", "CONFIRMED", "PREPARING", "READY"].includes(o.status))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return activeMemoryOrders.map((o) => ({
      order_id: o.id,
      order_number: o.order_number,
      source: o.source,
      service_type: o.service_type,
      order_status: o.status as any,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      table_number: o.table?.table_number || null,
      table_name: o.table?.name || (o.table?.table_number ? `Meja ${o.table?.table_number}` : null),
      total_amount: Number(o.total_amount),
      order_notes: o.notes || null,
      payment_method: o.payment?.method || null,
      payment_status: o.payment?.status || null,
      created_at: new Date(o.created_at).toISOString(),
      items: o.items.map((i) => ({
        id: i.id,
        product_name: i.product_name_snapshot,
        quantity: i.quantity,
        notes: i.item_notes || null,
        options: i.options?.map((opt) => opt.option_name_snapshot) || [],
      })),
    }));
  } catch (err) {
    console.error("Gagal mengambil antrean dapur:", err);
    return [];
  }
}

/**
 * Mengubah status pesanan dari Dapur (PREPARING atau READY).
 * Memicu TRIGGER `trg_audit_order_status_change` di level database secara otomatis.
 */
export async function updateKitchenOrderStatusAction(
  orderId: string,
  newStatus: "PREPARING" | "READY" | "COMPLETED"
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const chef = await requireChef();

    if (await isDatabaseReady()) {
      try {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return { success: false, error: "Pesanan tidak ditemukan." };

        // Set session user variable untuk trigger database MySQL
        await prisma.$executeRawUnsafe(
          `SET @app_current_user_id = ?, @app_current_user_role = ?`,
          chef.sub,
          chef.role
        );

        // Update status pesanan (Akan memicu trg_audit_order_status_change)
        await prisma.order.update({
          where: { id: orderId },
          data: { status: newStatus },
        });

        // Audit log app layer
        await recordAuditLog({
          actorId: chef.sub,
          actorName: chef.name,
          actorRole: chef.role,
          entityName: "orders",
          entityId: orderId,
          action: "UPDATE_KITCHEN_ORDER_STATUS",
          oldData: { status: order.status },
          newData: { status: newStatus },
          reason: `Status pesanan diubah oleh Chef/Dapur menjadi ${newStatus}`,
        });

        revalidatePath("/chef");
        revalidatePath("/cashier");
        return { success: true, message: `Status pesanan berhasil diubah menjadi ${newStatus}.` };
      } catch (err) {
        console.warn("Gagal update status pesanan di Prisma:", err);
      }
    }

    // Memory Store update
    const memOrder = memoryOrders.get(orderId);
    if (!memOrder) return { success: false, error: "Pesanan tidak ditemukan di memory." };

    memOrder.status = newStatus as any;

    revalidatePath("/chef");
    revalidatePath("/cashier");
    return { success: true, message: `Status pesanan berhasil diubah menjadi ${newStatus}.` };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal memperbarui status pesanan." };
  }
}

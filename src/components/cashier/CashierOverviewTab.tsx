"use client";

import React from "react";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CheckCircle2,
  Clock,
  Coffee,
  ExternalLink,
  Flame,
  LayoutDashboard,
  Plus,
  QrCode,
  Receipt,
  ShoppingBag,
  TrendingUp,
  User,
  Utensils,
  XCircle,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import type { CashierDashboardPayload, CashierOrder, CashierTabKey } from "@/lib/cashier/types";

interface CashierOverviewTabProps {
  data: CashierDashboardPayload;
  cashierName: string;
  onNavigateTab: (tab: CashierTabKey) => void;
  onOpenCashModal: (order: CashierOrder) => void;
}

export function CashierOverviewTab({
  data,
  cashierName,
  onNavigateTab,
  onOpenCashModal,
}: CashierOverviewTabProps) {
  const { orders, tables, products, categories } = data;

  // Kalkulasi Metrik Shift Kasir
  const paidOrders = orders.filter((o) => o.payment.status === "PAID");
  const pendingOrders = orders.filter(
    (o) =>
      o.status !== "CANCELLED" &&
      o.status !== "COMPLETED" &&
      (o.payment.status === "UNPAID" || o.payment.status === "PENDING"),
  );
  const preparingOrders = orders.filter((o) => o.status === "PREPARING");

  const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.totalAmount || o.payment?.amountPaid) || 0), 0);
  const cashRevenue = paidOrders
    .filter((o) => o.payment.method === "CASH")
    .reduce((sum, o) => sum + (Number(o.totalAmount || o.payment?.amountPaid) || 0), 0);
  const nonCashRevenue = paidOrders
    .filter((o) => o.payment.method !== "CASH")
    .reduce((sum, o) => sum + (Number(o.totalAmount || o.payment?.amountPaid) || 0), 0);

  const activeTables = tables.filter((t) => t.isActive);
  const occupiedTables = activeTables.filter((t) => t.status === "OCCUPIED");

  // Menu Habis / Kritis
  const outOfStockProducts = products.filter((p) => !p.isAvailable || p.availableQty <= 0);
  const lowStockProducts = products.filter(
    (p) => p.isAvailable && p.availableQty > 0 && p.availableQty <= p.minThreshold,
  );

  return (
    <div className="space-y-6">
      {/* 1. Header Banner Shift Kasir */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground">
              Dashboard Operasional Kasir
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab("pos")}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-primary-hover active:scale-[0.99] cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Buka Terminal POS</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("queue")}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary-bg px-3.5 py-2.5 text-xs font-bold text-foreground transition hover:bg-border/60 active:scale-[0.99] cursor-pointer"
            >
              <Clock className="size-4 text-primary" />
              <span>Antrean Pesanan ({orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status)).length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Grid 4 Kartu Metrik Kasir */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Transaksi Lunas */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">Total Transaksi Selesai</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-foreground">{paidOrders.length}</p>
          <span className="font-mono text-xs font-bold text-emerald-600">
            {formatRupiah(totalRevenue)} omzet shift
          </span>
        </div>

        {/* Uang Tunai di Laci Kasir */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">Uang Fisik Kas (Tunai)</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
              <Banknote className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-xl sm:text-2xl font-black text-amber-900">
            {formatRupiah(cashRevenue)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Wajib ada di laci kasir saat setoran
          </span>
        </div>

        {/* Penerimaan Non-Tunai / Midtrans */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">Non-Tunai (Midtrans)</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700">
              <span className="font-mono text-[10px] font-black">PAY</span>
            </div>
          </div>
          <p className="mt-2 font-mono text-xl sm:text-2xl font-black text-sky-800">
            {formatRupiah(nonCashRevenue)}
          </p>
          <span className="text-[11px] text-muted-foreground">Settlement gateway Midtrans</span>
        </div>

        {/* Okupansi Meja Dine-In */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">Okupansi Meja</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-700">
              <Utensils className="size-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-foreground">
            {occupiedTables.length}{" "}
            <span className="text-xs text-muted-foreground font-normal">
              / {activeTables.length} Meja
            </span>
          </p>
          <span className="text-[11px] text-muted-foreground">
            {activeTables.length - occupiedTables.length} meja kosong siap pakai
          </span>
        </div>
      </div>

      {/* 3. Dua Kolom: Pesanan Butuh Pelunasan & Alert Stok Menu */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Kolom Kiri: Pesanan Menunggu Pembayaran Tunai */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-amber-500 animate-ping" />
                <h4 className="text-sm font-extrabold text-foreground">
                  Menunggu Pembayaran Kasir ({pendingOrders.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("queue")}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Lihat Semua Antrean →
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {pendingOrders.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto size-7 text-emerald-500 mb-1.5" />
                  <p className="text-xs font-bold text-foreground">Semua Pesanan Sudah Lunas</p>
                  <p className="text-[11px] text-muted-foreground">Tidak ada pesanan menggantung yang belum dibayar.</p>
                </div>
              ) : (
                pendingOrders.slice(0, 4).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-[#F4F7F6]/60 p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-foreground">
                          {order.orderNumber}
                        </span>
                        <span className="rounded bg-amber-100 px-1.5 py-0.2 font-mono text-[9px] font-bold text-amber-800">
                          {order.serviceType === "DINE_IN" ? `Meja ${order.tableNumber || "-"}` : "Takeaway"}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                        {order.customerName} • {order.items.length} item •{" "}
                        <strong className="text-foreground">{formatRupiah(order.totalAmount)}</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenCashModal(order)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer"
                    >
                      <Banknote className="size-3.5" />
                      <span>Bayar</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {pendingOrders.length > 4 && (
            <div className="mt-3 text-center border-t border-border/60 pt-2">
              <span className="text-[11px] text-muted-foreground">
                + {pendingOrders.length - 4} pesanan menunggu pembayaran lainnya
              </span>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Peringatan Ketersediaan Menu & Stok */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-600" />
                <h4 className="text-sm font-extrabold text-foreground">
                  Peringatan Stok Menu
                </h4>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("stock")}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Cek Tabel Stok →
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto size-7 text-emerald-500 mb-1.5" />
                  <p className="text-xs font-bold text-foreground">Semua Stok Porsi Aman</p>
                  <p className="text-[11px] text-muted-foreground">Tidak ada menu yang habis atau melewati batas minimum.</p>
                </div>
              ) : (
                <>
                  {/* Menu Habis */}
                  {outOfStockProducts.slice(0, 3).map((prod) => (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/50 p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="rounded bg-red-100 px-1.5 py-0.2 text-[9px] font-black text-red-700 uppercase">
                          Habis (0 Porsi)
                        </span>
                        <p className="truncate text-xs font-bold text-foreground mt-0.5">
                          {prod.name}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-black text-red-700 shrink-0">
                        0 Sisa
                      </span>
                    </div>
                  ))}

                  {/* Menu Menipis */}
                  {lowStockProducts.slice(0, 2).map((prod) => (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-black text-amber-800 uppercase">
                          Stok Menipis
                        </span>
                        <p className="truncate text-xs font-bold text-foreground mt-0.5">
                          {prod.name}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-black text-amber-800 shrink-0">
                        {prod.availableQty} Porsi
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-[11px] text-muted-foreground">
              Total {products.length} menu aktif terdaftar
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab("pos")}
              className="text-xs font-extrabold text-primary hover:underline cursor-pointer"
            >
              Mulai Input Order POS →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


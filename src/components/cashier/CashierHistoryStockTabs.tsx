"use client";

import { useState } from "react";
import {
  Printer,
  Banknote,
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Receipt,
  Boxes,
} from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { getStockStatus } from "@/lib/menu-data";
import { cn } from "@/lib/utils";
import type { AdminCategory, AdminProduct } from "@/lib/admin/types";
import type { CashierOrder } from "@/lib/cashier/types";

interface CashierHistoryTabProps {
  orders: CashierOrder[];
  searchQuery: string;
  onOpenReceiptModal: (order: CashierOrder) => void;
  onOpenCashModal: (order: CashierOrder) => void;
}

interface CashierStockTabProps {
  categories: AdminCategory[];
  products: AdminProduct[];
  searchQuery: string;
}

function formatRupiah(amount: number | null | undefined): string {
  const val = typeof amount === "number" && !Number.isNaN(amount) && Number.isFinite(amount) ? amount : 0;
  return `Rp ${Math.round(val).toLocaleString("id-ID")}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CashierHistoryTab({
  orders,
  searchQuery,
  onOpenReceiptModal,
  onOpenCashModal,
}: CashierHistoryTabProps) {
  const [methodFilter, setMethodFilter] = useState<"ALL" | "CASH" | "QRIS">("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");

  const filtered = orders.filter((o) => {
    if (methodFilter !== "ALL" && o.payment.method !== methodFilter) return false;
    if (paymentStatusFilter !== "ALL" && o.payment.status !== paymentStatusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-extrabold text-foreground">
            Riwayat Transaksi &amp; Cetak Ulang Struk
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-[#F4F7F6] p-1">
            {(["ALL", "CASH", "QRIS"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
                  methodFilter === m
                    ? "bg-[#0E2A2E] text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "ALL" ? "Semua Metode" : m === "CASH" ? "Tunai" : "QRIS"}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-xl border border-border bg-[#F4F7F6] p-1">
            {(["ALL", "PAID", "UNPAID"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setPaymentStatusFilter(st)}
                className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
                  paymentStatusFilter === st
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st === "ALL" ? "Semua Status" : st === "PAID" ? "Lunas" : "Belum Bayar"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-[#F4F7F6] text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3.5">No. Pesanan</th>
                <th className="px-4 py-3.5">Waktu</th>
                <th className="px-4 py-3.5">Pelanggan &amp; Layanan</th>
                <th className="px-4 py-3.5">Status Order</th>
                <th className="px-4 py-3.5">Pembayaran</th>
                <th className="px-4 py-3.5 text-right">Total &amp; Kembalian</th>
                <th className="px-4 py-3.5 text-right">Aksi Struk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Tidak ada transaksi yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => {
                  const isPaid = order.payment.status === "PAID";
                  return (
                    <tr key={order.id} className="transition hover:bg-[#F4F7F6]/60">
                      <td className="px-4 py-3.5">
                        <p className="font-mono font-black text-[#0E2A2E]">{order.orderNumber}</p>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Sumber: {order.source}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-foreground">{order.customerName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {order.serviceType === "DINE_IN"
                            ? `Dine In • Meja ${order.tableNumber || "-"}`
                            : "Takeaway / Bungkus"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-full bg-[#F4F7F6] px-2.5 py-1 font-mono text-[10px] font-extrabold text-foreground">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            isPaid
                              ? "bg-emerald-500/15 text-emerald-800"
                              : "bg-amber-500/20 text-amber-900"
                          }`}
                        >
                          {order.payment.method} • {isPaid ? "LUNAS" : "BELUM BAYAR"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <p className="font-mono font-black text-[#0E2A2E]">
                          {formatRupiah(order.totalAmount)}
                        </p>
                        {isPaid && order.payment.changeAmount > 0 && (
                          <p className="font-mono text-[10px] font-bold text-emerald-700">
                            Kembali: {formatRupiah(order.payment.changeAmount)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {!isPaid &&
                            order.status !== "CANCELLED" &&
                            order.payment.method === "CASH" && (
                              <button
                                type="button"
                                onClick={() => onOpenCashModal(order)}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-700"
                              >
                                <Banknote className="h-3.5 w-3.5" />
                                <span>Bayar</span>
                              </button>
                            )}
                          {isPaid && (
                            <button
                              type="button"
                              onClick={() => onOpenReceiptModal(order)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-extrabold text-[#0E2A2E] transition hover:border-primary hover:bg-primary/5"
                            >
                              <Printer className="h-3.5 w-3.5 text-primary" />
                              <span>Cetak Struk</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CashierStockTab({
  categories,
  products,
  searchQuery,
}: CashierStockTabProps) {
  const [catFilter, setCatFilter] = useState<string>("ALL");

  const filtered = products.filter((p) => {
    if (catFilter !== "ALL" && p.categoryId !== catFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.categoryName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-extrabold text-foreground">
            Ketersediaan Stok Menu
          </h3>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCatFilter("ALL")}
            className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
              catFilter === "ALL"
                ? "bg-[#0E2A2E] text-white"
                : "border border-border bg-[#F4F7F6] text-foreground hover:bg-muted"
            }`}
          >
            Semua ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatFilter(c.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                catFilter === c.id
                  ? "bg-[#0E2A2E] text-white"
                  : "border border-border bg-[#F4F7F6] text-foreground hover:bg-muted"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {filtered.map((product) => {
          const status = getStockStatus(product.availableQty, product.minThreshold);
          const isOut = !product.isAvailable || product.availableQty <= 0;

          return (
            <article
              key={product.id}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xs transition-all hover:border-primary/40 hover:shadow-sm",
                isOut && "opacity-75",
              )}
            >
              {/* Gambar Produk Rasio Aspect-Video */}
              <div className="relative aspect-video w-full overflow-hidden bg-secondary-bg">
                <ProductImage
                  product={{
                    id: product.id,
                    name: product.name,
                    imageUrl: product.imageUrl || undefined,
                    emoji: "🍽️",
                  }}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                />

                {/* Badge Status Stok Mengambang */}
                <div className="absolute left-2.5 top-2.5">
                  <StockBadge status={status} />
                </div>
              </div>

              {/* Konten Menu */}
              <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-3.5">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-[10px] sm:text-[11px] font-semibold text-muted-foreground">
                    {product.categoryName}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">
                    Min: {product.minThreshold}
                  </span>
                </div>

                <h4 className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground">
                  {product.name}
                </h4>

                <p className="line-clamp-2 min-h-[2rem] text-[11px] leading-relaxed text-muted-foreground">
                  {product.description || `${product.categoryName} khas Warkop Agam`}
                </p>

                <div className="mt-auto border-t border-border/60 pt-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs sm:text-sm font-extrabold text-foreground">
                      {formatRupiah(product.basePrice)}
                    </span>
                    <span
                      className={cn(
                        "rounded-lg px-2 py-0.5 font-mono text-xs font-black",
                        isOut
                          ? "bg-red-500/10 text-red-700"
                          : status === "LOW_STOCK"
                            ? "bg-amber-500/10 text-amber-800"
                            : "bg-emerald-500/10 text-emerald-800",
                      )}
                    >
                      Sisa: {product.availableQty} porsi
                    </span>
                  </div>

                  {/* Rincian Alokasi Stok (Siap Dijual vs Dipesan Meja) */}
                  <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-[#F4F7F6] p-2 text-center text-[10px]">
                    <div>
                      <span className="block text-[9px] text-muted-foreground">Siap Dijual</span>
                      <span className="font-mono font-black text-foreground">
                        {product.availableQty}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-muted-foreground">Dipesan Meja</span>
                      <span className="font-mono font-black text-amber-700">
                        {product.reservedQty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

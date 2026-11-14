"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Plus,
  Receipt,
  ReceiptText,
  Search,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  XCircle,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import type {
  AdminCategory,
  AdminProduct,
  DetailedSalesReport,
  DashboardSummary,
  PeriodKey,
  ReportTransactionItem,
} from "@/lib/admin/types";
import type { AdminTabKey } from "./admin-ui";

export interface AdminOverviewTabProps {
  summary: DashboardSummary;
  categories: AdminCategory[];
  products: AdminProduct[];
  detailedReport: DetailedSalesReport;
  activePeriod: PeriodKey;
  fromParam?: string;
  toParam?: string;
  onPeriodChange: (period: PeriodKey, from?: string, to?: string) => void;
  onNavigateTab: (tab: AdminTabKey) => void;
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "7d", label: "7 Hari" },
  { key: "month", label: "Bulan Ini" },
  { key: "custom", label: "Kustom" },
];

export function AdminOverviewTab({
  summary,
  categories,
  products,
  detailedReport,
  activePeriod,
  fromParam,
  toParam,
  onPeriodChange,
  onNavigateTab,
}: AdminOverviewTabProps) {
  const [customFrom, setCustomFrom] = useState(fromParam || summary.from.slice(0, 10));
  const [customTo, setCustomTo] = useState(toParam || summary.to.slice(0, 10));
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [catalogSearch, setCatalogSearch] = useState<string>("");

  const maxChartSales = Math.max(1, ...summary.chart.map((c) => c.netSales));

  // Filter produk untuk grid preview katalog
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === "ALL" || p.categoryId === selectedCategory;
    const matchSearch =
      !catalogSearch ||
      p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      p.categoryName?.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  // Recent live transactions / Current sale feed
  const liveTransactions = detailedReport.recentTransactions.slice(0, 8);

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Selesai</span>;
      case "READY":
        return <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">Siap</span>;
      case "PREPARING":
        return <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">Dimasak</span>;
      case "CONFIRMED":
        return <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Konfirmasi</span>;
      case "CANCELLED":
        return <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">Batal</span>;
      case "PENDING":
      default:
        return <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Peringatan Stok Kritis (Jika Ada) */}
      {(summary.outOfStockCount > 0 || summary.lowStockCount > 0) && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Perhatian Stok Porsi Harian</p>
              <p className="text-xs text-muted-foreground">
                {summary.outOfStockCount > 0 && (
                  <span className="font-semibold text-error">{summary.outOfStockCount} menu habis</span>
                )}
                {summary.outOfStockCount > 0 && summary.lowStockCount > 0 && " · "}
                {summary.lowStockCount > 0 && (
                  <span className="font-semibold text-amber-700">
                    {summary.lowStockCount} menu menipis di bawah batas minimum
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("stock")}
            className="inline-flex items-center gap-1 self-start rounded-xl border border-warning/40 bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary-bg sm:self-auto cursor-pointer"
          >
            Kelola Stok Porsi
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* FILTER PERIODE & RANGE */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Filter Rentang Analisis</h2>
          <p className="text-xs text-muted-foreground">
            Periode aktif: <span className="font-semibold text-foreground">{summary.rangeLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-secondary-bg/60 p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  if (opt.key === "custom") {
                    onPeriodChange("custom", customFrom, customTo);
                  } else {
                    onPeriodChange(opt.key);
                  }
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  activePeriod === opt.key
                    ? "bg-white text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {activePeriod === "custom" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onPeriodChange("custom", customFrom, customTo);
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-foreground"
              />
              <span className="text-xs text-muted-foreground">s/d</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-foreground"
              />
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover cursor-pointer"
              >
                Terapkan
              </button>
            </form>
          )}
        </div>
      </div>

      {/* WORKSPACE DUA KOLOM: KIRI (GRAFIK & KATALOG) | KANAN (CURRENT SALE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* SISI KIRI (7 / 12 Kolom): GRAFIK PENJUALAN & KATALOG PREVIEW */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 1. GRAFIK TREN PENJUALAN HARIAN */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Tren Penjualan Harian</h3>
              </div>
              <span className="text-xs font-mono font-bold text-primary">
                {formatRupiah(summary.netSales)} Net
              </span>
            </div>

            <div className="mt-4 flex h-48 items-end gap-1.5 pt-4">
              {summary.chart.map((point, idx) => {
                const heightPct = Math.max(6, Math.round((point.netSales / maxChartSales) * 100));
                const isHovered = hoveredIdx === idx;
                return (
                  <div
                    key={`${point.label}-${idx}`}
                    className="relative flex flex-1 flex-col items-center h-full justify-end group cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {isHovered && (
                      <div className="absolute -top-12 z-20 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[10px] font-bold text-background shadow-lg">
                        <p>{point.label}</p>
                        <p className="font-mono text-primary">{formatRupiah(point.netSales)}</p>
                      </div>
                    )}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isHovered ? "bg-primary" : "bg-primary/25 hover:bg-primary/50"
                      }`}
                    />
                    <span className="mt-1.5 truncate text-[9px] font-mono text-muted-foreground w-full text-center">
                      {point.label.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. KATALOG MENU PREVIEW DENGAN FILTER KATEGORI (Seperti sisi kanan di gambar) */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-foreground">Katalog Menu &amp; Stok</h3>
                <p className="text-xs text-muted-foreground">Pilihan hidangan aktif di Warkop Agam</p>
              </div>

              {/* Filter Kategori Pills */}
              <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("ALL")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    selectedCategory === "ALL"
                      ? "bg-primary text-white shadow-2xs"
                      : "bg-secondary-bg text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Semua ({products.length})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedCategory === c.id
                        ? "bg-primary text-white shadow-2xs"
                        : "bg-secondary-bg text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Kartu Menu (Format Gambar Referensi) */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredProducts.slice(0, 12).map((prod) => (
                <div
                  key={prod.id}
                  className="rounded-2xl border border-border bg-secondary-bg/40 p-3 hover:border-primary/50 hover:bg-white transition-all flex flex-col justify-between group shadow-2xs"
                >
                  <div>
                    <div className="aspect-square w-full rounded-xl bg-white border border-border/60 flex items-center justify-center text-3xl mb-2.5 overflow-hidden shadow-2xs">
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <span>☕</span>
                      )}
                    </div>
                    <p className="font-bold text-xs text-foreground line-clamp-1">{prod.name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{prod.categoryName}</p>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/60">
                    <span className="font-mono text-xs font-black text-primary">
                      {formatRupiah(prod.basePrice)}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        prod.isAvailable && prod.availableQty > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {prod.isAvailable && prod.availableQty > 0 ? `${prod.availableQty} porsi` : "Habis"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ingin menambah atau mengedit menu?</span>
              <button
                type="button"
                onClick={() => onNavigateTab("catalog")}
                className="inline-flex items-center gap-1 font-bold text-primary hover:underline cursor-pointer"
              >
                <span>Buka Manajemen Menu</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 3. MENU TERLARIS (TOP SELLING) */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Menu Paling Laris Periode Ini</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("reports")}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Lihat Laporan Lengkap
              </button>
            </div>

            <div className="mt-3 divide-y divide-border/60">
              {summary.topProducts.slice(0, 5).map((p, idx) => (
                <div key={p.productId} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary-bg font-mono text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.qty} porsi terjual</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {formatRupiah(p.revenue)}
                  </span>
                </div>
              ))}
              {summary.topProducts.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Belum ada data penjualan pada rentang periode ini.
                </p>
              )}
            </div>
          </div>

        </div>

        {/* SISI KANAN (5 / 12 Kolom): CURRENT SALE / LIVE ORDERS (Sesuai Permintaan Khusus User) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border-2 border-primary/20 bg-white p-5 shadow-md">
            
            {/* Header Current Sale */}
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-base font-black tracking-tight text-foreground">Current Sale</h3>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                Live Feed
              </span>
            </div>

            {/* List Transaksi / Pesanan Terkini */}
            <div className="mt-4 space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {liveTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-xl border border-border bg-secondary-bg/50 p-3 hover:border-primary/40 hover:bg-white transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-foreground">
                        {tx.orderNumber}
                      </span>
                      {getOrderStatusBadge(tx.orderStatus)}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-foreground text-xs">{tx.customerName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {tx.serviceType === "DINE_IN"
                          ? `Dine In (Meja ${tx.tableNumber || "-"})`
                          : "Takeaway"}{" "}
                        • {tx.paymentMethod}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-primary">
                      {formatRupiah(tx.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}

              {liveTransactions.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <Receipt className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs font-bold">Belum Ada Transaksi</p>
                  <p className="text-[11px]">Pesanan yang baru masuk akan muncul secara real-time di sini.</p>
                </div>
              )}
            </div>

            {/* Ringkasan Akumulasi Saldo / Total Kasir */}
            <div className="mt-5 pt-4 border-t border-border space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal Penjualan</span>
                <span className="font-mono font-medium">{formatRupiah(summary.grossSales)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pajak Restoran (PB1 10%)</span>
                <span className="font-mono font-medium">{formatRupiah(summary.taxCollected)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border text-foreground">
                <span className="text-sm font-black">Total Net Sales</span>
                <span className="font-mono text-lg font-black text-primary">
                  {formatRupiah(summary.netSales)}
                </span>
              </div>
            </div>

            {/* Tombol Aksi Cepat Bawah (Seperti Pay / Clear Cart di referensi) */}
            <div className="mt-5 space-y-2 pt-2 border-t border-border/80">
              <Link
                href="/cashier"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-primary-hover active:scale-[0.99] cursor-pointer"
              >
                <UtensilsCrossed className="h-4 w-4" />
                <span>Buka Layanan POS Kasir</span>
              </Link>

              <button
                type="button"
                onClick={() => onNavigateTab("reports")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary-bg py-2.5 text-xs font-bold text-foreground transition-all hover:bg-border/60 active:scale-[0.99] cursor-pointer"
              >
                <ReceiptText className="h-3.5 w-3.5" />
                <span>Lihat Laporan Transaksi Lengkap</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

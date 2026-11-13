"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import type { DashboardSummary, PeriodKey } from "@/lib/admin/types";
import type { AdminTabKey } from "./admin-ui";

interface AdminOverviewTabProps {
  summary: DashboardSummary;
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
  activePeriod,
  fromParam,
  toParam,
  onPeriodChange,
  onNavigateTab,
}: AdminOverviewTabProps) {
  const [customFrom, setCustomFrom] = useState(
    fromParam || summary.from.slice(0, 10),
  );
  const [customTo, setCustomTo] = useState(
    toParam || summary.to.slice(0, 10),
  );
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxChartSales = Math.max(1, ...summary.chart.map((c) => c.netSales));
  const totalPayCount = summary.paymentSplit.cash + summary.paymentSplit.digital;
  const cashPct = totalPayCount
    ? Math.round((summary.paymentSplit.cash / totalPayCount) * 100)
    : 0;
  const digitalPct = totalPayCount ? 100 - cashPct : 0;

  return (
    <div className="space-y-6">
      {/* Filter Periode */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Ringkasan &amp; Analitik Penjualan
          </h2>
          <p className="text-xs text-muted-foreground">
            Periode aktif: <span className="font-medium text-foreground">{summary.rangeLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-secondary-bg p-1">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activePeriod === opt.key
                    ? "bg-background text-foreground shadow-xs"
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
                aria-label="Tanggal mulai"
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              />
              <span className="text-xs text-muted-foreground">s/d</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="Tanggal akhir"
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              />
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                Terapkan
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Peringatan Stok */}
      {(summary.outOfStockCount > 0 || summary.lowStockCount > 0) && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">
                Perhatian Stok Porsi Harian
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.outOfStockCount > 0 && (
                  <span className="font-semibold text-error">
                    {summary.outOfStockCount} menu habis
                  </span>
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
            className="inline-flex items-center gap-1 self-start rounded-xl border border-warning/40 bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary-bg sm:self-auto"
          >
            Kelola Stok Porsi
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-background p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Penjualan Bersih (Net Sales)</span>
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            {formatRupiah(summary.netSales)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Kotor {formatRupiah(summary.grossSales)} · Pajak {formatRupiah(summary.taxCollected)}
            {summary.refunds > 0 ? ` · Refund ${formatRupiah(summary.refunds)}` : ""}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Order Sukses</span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            {summary.successfulOrders}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              / {summary.totalOrders} total
            </span>
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Pembayaran lunas (PAID) pada periode terpilih
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Rata-Rata Transaksi (AOV)</span>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            {formatRupiah(summary.averageOrderValue)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Net sales dibagi jumlah order sukses
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Rasio Pembatalan</span>
            <XCircle
              className={`h-4 w-4 ${
                summary.cancellationRate > 10 ? "text-error" : "text-muted-foreground"
              }`}
            />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            {summary.cancellationRate.toFixed(1)}%
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {summary.cancelledOrders} order dibatalkan dari {summary.totalOrders} order
          </p>
        </div>
      </div>

      {/* Chart + Payment Split + Top Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Grafik Penjualan */}
        <div className="rounded-2xl border border-border bg-background p-5 shadow-xs lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <BarChart3 className="h-4 w-4 text-primary" />
                Grafik Penjualan Bersih
              </h3>
              <p className="text-xs text-muted-foreground">
                {activePeriod === "today" ? "Distribusi per jam" : "Distribusi harian"}
              </p>
            </div>
            {hoveredIdx !== null && summary.chart[hoveredIdx] && (
              <div className="rounded-lg border border-border bg-secondary-bg px-3 py-1.5 text-right text-xs">
                <span className="font-semibold text-foreground">
                  {summary.chart[hoveredIdx].label}:{" "}
                </span>
                <span className="font-mono font-bold text-primary">
                  {formatRupiah(summary.chart[hoveredIdx].netSales)}
                </span>
                <span className="ml-1.5 text-muted-foreground">
                  ({summary.chart[hoveredIdx].orders} order)
                </span>
              </div>
            )}
          </div>

          {summary.chart.length === 0 ? (
            <div className="flex h-56 items-center justify-center rounded-xl bg-secondary-bg/60 text-xs text-muted-foreground">
              Belum ada data transaksi pada periode ini.
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex h-56 min-w-[460px] items-end gap-1.5 rounded-xl border border-border/70 bg-secondary-bg/40 px-3 pt-6 pb-3">
                {summary.chart.map((pt, idx) => {
                  const pct = Math.max(4, Math.round((pt.netSales / maxChartSales) * 100));
                  const isActive = hoveredIdx === idx;
                  return (
                    <div
                      key={`${pt.label}-${idx}`}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                    >
                      <div className="relative flex w-full flex-1 items-end justify-center">
                        <div
                          style={{ height: `${pt.netSales > 0 ? pct : 3}%` }}
                          className={`w-full max-w-[28px] rounded-t-md transition-all ${
                            pt.netSales === 0
                              ? "bg-border/70"
                              : isActive
                                ? "bg-primary-hover"
                                : "bg-primary/85 group-hover:bg-primary"
                          }`}
                          title={`${pt.label}: ${formatRupiah(pt.netSales)} (${pt.orders} order)`}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {summary.chart.length > 16 && idx % 2 === 1 ? "" : pt.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sisi Kanan: Payment Split & Top 5 Menu */}
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-border bg-background p-5 shadow-xs">
            <h3 className="text-sm font-bold text-foreground">Proporsi Metode Bayar</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Perbandingan transaksi lunas Tunai vs Digital
            </p>

            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-secondary-bg">
              {totalPayCount > 0 && (
                <div className="flex h-full w-full">
                  <div
                    style={{ width: `${cashPct}%` }}
                    className="h-full bg-success transition-all"
                  />
                  <div
                    style={{ width: `${digitalPct}%` }}
                    className="h-full bg-primary transition-all"
                  />
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <Wallet className="h-3.5 w-3.5 text-success" />
                  Tunai / Kasir ({cashPct}%)
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {summary.paymentSplit.cash} · {formatRupiah(summary.paymentSplit.cashAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  Digital QRIS/VA ({digitalPct}%)
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {summary.paymentSplit.digital} · {formatRupiah(summary.paymentSplit.digitalAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5 shadow-xs">
            <h3 className="text-sm font-bold text-foreground">Top 5 Menu Terlaris</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Berdasarkan total porsi terjual
            </p>

            {summary.topProducts.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Belum ada menu terjual pada periode ini.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {summary.topProducts.map((item, i) => (
                  <li key={`${item.productId}-${i}`} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary-bg font-mono text-[11px] font-bold text-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{item.qty} porsi</p>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-bold text-foreground">
                      {formatRupiah(item.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

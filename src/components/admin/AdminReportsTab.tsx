"use client";

import React, { useState } from "react";
import {
  Calendar,
  Download,
  FileSpreadsheet,
  History,
  Printer,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import type {
  AdminStockMovement,
  DetailedSalesReport,
  PeriodKey,
} from "@/lib/admin/types";
import { formatDateTimeId, ModalFrame } from "./admin-ui";

interface AdminReportsTabProps {
  report: DetailedSalesReport;
  movements: AdminStockMovement[];
  onPeriodChange: (period: PeriodKey, from?: string, to?: string) => void;
  restaurantName?: string;
}

type ReportSubTab = "SALES" | "MENU_PERFORMANCE" | "STOCK_MOVEMENTS";

export function AdminReportsTab({
  report,
  movements,
  onPeriodChange,
  restaurantName = "Warkop Agam Medan",
}: AdminReportsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>("SALES");
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Custom date state
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Helper labels
  const getPaymentMethodLabel = (method: string) => {
    switch (method.toUpperCase()) {
      case "CASH":
        return "Tunai (Kasir POS)";
      case "QRIS":
        return "QRIS Dinamis";
      case "VIRTUAL_ACCOUNT":
        return "Virtual Account Bank";
      default:
        return method;
    }
  };

  const getServiceTypeLabel = (st: string) => {
    return st.toUpperCase() === "DINE_IN"
      ? "Dine In (Makan di Tempat)"
      : "Takeaway (Bungkus)";
  };

  // Handler Ganti Periode
  const handleSelectPeriod = (p: PeriodKey) => {
    if (p === "custom") {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
      onPeriodChange(p);
    }
  };

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (customFrom && customTo) {
      onPeriodChange("custom", customFrom, customTo);
    }
  };

  // Helper: Download CSV File
  const downloadCsv = (filename: string, content: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Ekspor CSV Transaksi Penjualan
  const handleExportSalesCsv = () => {
    const headers = [
      "No. Order",
      "Tanggal & Waktu",
      "Nama Pelanggan",
      "No. WhatsApp",
      "Tipe Layanan",
      "Meja",
      "Metode Pembayaran",
      "Status Pesanan",
      "Subtotal (Rp)",
      "Pajak (Rp)",
      "Total Transaksi (Rp)",
    ];

    const rows = report.recentTransactions.map((tx) => [
      `"${tx.orderNumber}"`,
      `"${formatDateTimeId(tx.createdAt)}"`,
      `"${tx.customerName.replace(/"/g, '""')}"`,
      `"${tx.customerPhone}"`,
      `"${getServiceTypeLabel(tx.serviceType)}"`,
      `"${tx.tableNumber || "-"}"`,
      `"${getPaymentMethodLabel(tx.paymentMethod)}"`,
      `"${tx.orderStatus}"`,
      tx.subtotal,
      tx.taxAmount,
      tx.totalAmount,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    downloadCsv(`laporan-transaksi-penjualan-${report.rangeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, csvContent);
  };

  // Ekspor CSV Performa Menu
  const handleExportMenuCsv = () => {
    const headers = [
      "Peringkat",
      "Nama Menu",
      "Kategori",
      "Porsi Terjual",
      "Total Omzet (Rp)",
      "Kontribusi Omzet (%)",
    ];

    const rows = report.productPerformance.map((p, idx) => [
      idx + 1,
      `"${p.productName.replace(/"/g, '""')}"`,
      `"${p.categoryName.replace(/"/g, '""')}"`,
      p.quantitySold,
      p.totalRevenue,
      p.sharePercentage.toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    downloadCsv(`laporan-performa-menu-${report.rangeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, csvContent);
  };

  // Trigger Print PDF
  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Bar Filter Periode & Tombol Ekspor */}
      <div className="flex flex-col gap-4 rounded-xl border border-[#E7E5E3] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        {/* Periode Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1 text-xs font-semibold text-[#78716c]">
            <Calendar className="h-3.5 w-3.5" />
            Periode:
          </span>

          <button
            type="button"
            onClick={() => handleSelectPeriod("today")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              report.period === "today"
                ? "bg-[#272727] text-white shadow-sm"
                : "border border-[#E7E5E3] bg-white text-[#78716c] hover:bg-stone-50 hover:text-[#272727]"
            }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => handleSelectPeriod("7d")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              report.period === "7d"
                ? "bg-[#272727] text-white shadow-sm"
                : "border border-[#E7E5E3] bg-white text-[#78716c] hover:bg-stone-50 hover:text-[#272727]"
            }`}
          >
            7 Hari Terakhir
          </button>
          <button
            type="button"
            onClick={() => handleSelectPeriod("month")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              report.period === "month"
                ? "bg-[#272727] text-white shadow-sm"
                : "border border-[#E7E5E3] bg-white text-[#78716c] hover:bg-stone-50 hover:text-[#272727]"
            }`}
          >
            Bulan Ini
          </button>
          <button
            type="button"
            onClick={() => handleSelectPeriod("custom")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              report.period === "custom"
                ? "bg-[#272727] text-white shadow-sm"
                : "border border-[#E7E5E3] bg-white text-[#78716c] hover:bg-stone-50 hover:text-[#272727]"
            }`}
          >
            Kustom
          </button>
        </div>

        {/* Action Buttons: Export CSV & PDF */}
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E5E3] bg-white px-3 py-2 text-xs font-semibold text-[#272727] shadow-sm hover:border-[#F16F62] hover:text-[#F16F62] transition"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              Ekspor CSV
            </button>
            <div className="absolute right-0 top-full mt-1 hidden w-48 rounded-xl border border-[#E7E5E3] bg-white p-1 shadow-lg group-hover:block z-20">
              <button
                type="button"
                onClick={handleExportSalesCsv}
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-[#272727] hover:bg-stone-50 flex items-center gap-2"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Data Transaksi Penjualan
              </button>
              <button
                type="button"
                onClick={handleExportMenuCsv}
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-[#272727] hover:bg-stone-50 flex items-center gap-2"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-sky-600" />
                Data Performa Menu
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#272727] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition"
          >
            <Printer className="h-3.5 w-3.5 text-[#F16F62]" />
            Cetak / Ekspor PDF
          </button>
        </div>
      </div>

      {/* Form Kustom Rentang Tanggal jika dipilih */}
      {showCustomPicker && (
        <form
          onSubmit={handleApplyCustomDates}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[#F16F62]/60 bg-orange-50/40 p-4 text-xs"
        >
          <span className="font-semibold text-[#272727]">Tentukan Tanggal:</span>
          <div className="flex items-center gap-2">
            <label className="text-[#78716c]">Dari:</label>
            <input
              type="date"
              required
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-[#E7E5E3] bg-white px-2.5 py-1.5 text-xs text-[#272727] focus:border-[#F16F62] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[#78716c]">Sampai:</label>
            <input
              type="date"
              required
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-[#E7E5E3] bg-white px-2.5 py-1.5 text-xs text-[#272727] focus:border-[#F16F62] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#F16F62] px-4 py-1.5 font-semibold text-white hover:bg-[#d85e52]"
          >
            Terapkan Filter
          </button>
        </form>
      )}

      {/* KPI Cards Finansial */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Net Sales */}
        <div className="rounded-xl border border-[#E7E5E3] bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-[#78716c]">Penjualan Bersih (Net)</p>
          <div className="mt-2">
            <span className="text-xl font-bold text-[#F16F62]">
              {formatRupiah(report.summary.netSales)}
            </span>
            <p className="text-[11px] text-[#78716c] mt-0.5">Setelah dikurangi pajak</p>
          </div>
        </div>

        {/* Tax Collected */}
        <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 shadow-sm">
          <p className="text-xs font-medium text-stone-600">Pajak Terkumpul (PB1)</p>
          <div className="mt-2">
            <span className="text-xl font-bold text-stone-700">
              {formatRupiah(report.summary.taxCollected)}
            </span>
            <p className="text-[11px] text-stone-500 mt-0.5">Titipan pajak daerah</p>
          </div>
        </div>

        {/* Gross Sales */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium text-emerald-800">Total Omzet Bruto</p>
          <div className="mt-2">
            <span className="text-xl font-bold text-emerald-700">
              {formatRupiah(report.summary.grossSales)}
            </span>
            <p className="text-[11px] text-emerald-700 mt-0.5">Uang masuk kotor</p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium text-sky-800">Pesanan Selesai</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-sky-700">{report.summary.completedOrders}</span>
            <span className="text-xs text-sky-700">Transaksi</span>
          </div>
          <p className="text-[11px] text-sky-700 mt-0.5">{report.rangeLabel}</p>
        </div>

        {/* AOV */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs font-medium text-amber-800">Rata-rata Transaksi (AOV)</p>
          <div className="mt-2">
            <span className="text-xl font-bold text-amber-700">
              {formatRupiah(report.summary.averageOrderValue)}
            </span>
            <p className="text-[11px] text-amber-700 mt-0.5">Nilai per struk</p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#E7E5E3] gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveSubTab("SALES")}
          className={`pb-3 transition flex items-center gap-2 ${
            activeSubTab === "SALES"
              ? "border-b-2 border-[#F16F62] text-[#F16F62]"
              : "text-[#78716c] hover:text-[#272727]"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Rincian Omzet & Penjualan
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("MENU_PERFORMANCE")}
          className={`pb-3 transition flex items-center gap-2 ${
            activeSubTab === "MENU_PERFORMANCE"
              ? "border-b-2 border-[#F16F62] text-[#F16F62]"
              : "text-[#78716c] hover:text-[#272727]"
          }`}
        >
          <Utensils className="h-4 w-4" />
          Performa Menu ({report.productPerformance.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("STOCK_MOVEMENTS")}
          className={`pb-3 transition flex items-center gap-2 ${
            activeSubTab === "STOCK_MOVEMENTS"
              ? "border-b-2 border-[#F16F62] text-[#F16F62]"
              : "text-[#78716c] hover:text-[#272727]"
          }`}
        >
          <History className="h-4 w-4" />
          Mutasi Stok Porsi ({movements.length})
        </button>
      </div>

      {/* Sub-Tab 1: Rincian Omzet & Penjualan */}
      {activeSubTab === "SALES" && (
        <div className="space-y-6">
          {/* Distribusi Metode Pembayaran & Layanan */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Pembayaran */}
            <div className="rounded-xl border border-[#E7E5E3] bg-white p-5 shadow-sm">
              <h4 className="text-sm font-bold text-[#272727] flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#F16F62]" />
                Distribusi Metode Pembayaran
              </h4>
              <div className="mt-4 space-y-3">
                {report.paymentBreakdown.length === 0 ? (
                  <p className="text-xs text-stone-500 py-3 text-center">Belum ada data pembayaran.</p>
                ) : (
                  report.paymentBreakdown.map((item) => (
                    <div key={item.method} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#272727]">
                          {getPaymentMethodLabel(item.method)}
                        </span>
                        <span className="font-semibold text-[#272727]">
                          {formatRupiah(item.amount)} ({item.count} order • {item.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full bg-[#F16F62]"
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Layanan */}
            <div className="rounded-xl border border-[#E7E5E3] bg-white p-5 shadow-sm">
              <h4 className="text-sm font-bold text-[#272727] flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-sky-600" />
                Distribusi Tipe Layanan (Dine In vs Takeaway)
              </h4>
              <div className="mt-4 space-y-3">
                {report.serviceBreakdown.length === 0 ? (
                  <p className="text-xs text-stone-500 py-3 text-center">Belum ada data layanan.</p>
                ) : (
                  report.serviceBreakdown.map((item) => (
                    <div key={item.serviceType} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#272727]">
                          {getServiceTypeLabel(item.serviceType)}
                        </span>
                        <span className="font-semibold text-[#272727]">
                          {formatRupiah(item.amount)} ({item.count} order • {item.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                        <div
                          className={`h-full ${item.serviceType === "DINE_IN" ? "bg-amber-500" : "bg-sky-500"}`}
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Tabel Rincian Harian */}
          <div className="overflow-hidden rounded-xl border border-[#E7E5E3] bg-white shadow-sm">
            <div className="border-b border-[#E7E5E3] bg-[#F6F4F2] px-5 py-3.5 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#78716c]">
                Rincian Omzet Harian ({report.rangeLabel})
              </h4>
              <span className="text-xs text-[#78716c] font-medium">
                {report.dailySales.length} hari tercatat
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#272727]">
                <thead className="border-b border-[#E7E5E3] bg-stone-50/50 text-xs font-semibold text-[#78716c]">
                  <tr>
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-5 py-3 text-right">Pesanan</th>
                    <th className="px-5 py-3 text-right">Penjualan Bersih</th>
                    <th className="px-5 py-3 text-right">Pajak (PB1)</th>
                    <th className="px-5 py-3 text-right">Total Bruto</th>
                    <th className="px-5 py-3 text-right">AOV Harian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E3]">
                  {report.dailySales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-[#78716c]">
                        Belum ada transaksi pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    report.dailySales.map((d) => {
                      const dailyAov = d.ordersCount > 0 ? Math.round(d.grossAmount / d.ordersCount) : 0;
                      return (
                        <tr key={d.date} className="hover:bg-stone-50/50">
                          <td className="px-5 py-3.5 font-medium">{d.date}</td>
                          <td className="px-5 py-3.5 text-right font-mono">{d.ordersCount}</td>
                          <td className="px-5 py-3.5 text-right font-medium text-[#F16F62]">
                            {formatRupiah(d.netAmount)}
                          </td>
                          <td className="px-5 py-3.5 text-right text-stone-500">
                            {formatRupiah(d.taxAmount)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-emerald-700">
                            {formatRupiah(d.grossAmount)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-xs text-[#78716c]">
                            {formatRupiah(dailyAov)}
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
      )}

      {/* Sub-Tab 2: Performa Menu */}
      {activeSubTab === "MENU_PERFORMANCE" && (
        <div className="overflow-hidden rounded-xl border border-[#E7E5E3] bg-white shadow-sm">
          <div className="border-b border-[#E7E5E3] bg-[#F6F4F2] px-5 py-3.5 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#78716c]">
              Peringkat Penjualan Menu & Kontribusi Omzet
            </h4>
            <span className="text-xs text-[#78716c]">
              Urut berdasarkan total omzet penjualan tertinggi
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#272727]">
              <thead className="border-b border-[#E7E5E3] bg-stone-50/50 text-xs font-semibold text-[#78716c]">
                <tr>
                  <th className="px-5 py-3">Peringkat</th>
                  <th className="px-5 py-3">Menu</th>
                  <th className="px-5 py-3">Kategori</th>
                  <th className="px-5 py-3 text-right">Porsi Terjual</th>
                  <th className="px-5 py-3 text-right">Total Omzet</th>
                  <th className="px-5 py-3 text-right">Kontribusi Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E3]">
                {report.productPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#78716c]">
                      Belum ada penjualan menu pada periode ini.
                    </td>
                  </tr>
                ) : (
                  report.productPerformance.map((p, idx) => (
                    <tr key={p.productId} className="hover:bg-stone-50/50">
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            idx === 0
                              ? "bg-amber-100 text-amber-800"
                              : idx === 1
                              ? "bg-stone-200 text-stone-800"
                              : idx === 2
                              ? "bg-orange-100 text-orange-800"
                              : "text-[#78716c]"
                          }`}
                        >
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-[#272727]">
                        {p.productName}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#78716c]">
                        {p.categoryName}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-[#272727]">
                        {p.quantitySold} porsi
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[#F16F62]">
                        {formatRupiah(p.totalRevenue)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100">
                            <div
                              className="h-full bg-[#F16F62]"
                              style={{ width: `${Math.min(100, p.sharePercentage)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-stone-600">
                            {p.sharePercentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Mutasi Stok */}
      {activeSubTab === "STOCK_MOVEMENTS" && (
        <div className="overflow-hidden rounded-xl border border-[#E7E5E3] bg-white shadow-sm">
          <div className="border-b border-[#E7E5E3] bg-[#F6F4F2] px-5 py-3.5 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#78716c]">
              Log Riwayat Mutasi Stok Porsi Menu
            </h4>
            <span className="text-xs text-[#78716c]">
              Mencatat restock, pengurangan pesanan, dan penyesuaian manual
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#272727]">
              <thead className="border-b border-[#E7E5E3] bg-stone-50/50 text-xs font-semibold text-[#78716c]">
                <tr>
                  <th className="px-5 py-3">Waktu</th>
                  <th className="px-5 py-3">Menu</th>
                  <th className="px-5 py-3">Tipe Mutasi</th>
                  <th className="px-5 py-3 text-right">Perubahan Qty</th>
                  <th className="px-5 py-3 text-right">Sisa Stok</th>
                  <th className="px-5 py-3">Catatan / Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E3]">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#78716c]">
                      Belum ada riwayat mutasi stok.
                    </td>
                  </tr>
                ) : (
                  movements.slice(0, 50).map((m) => (
                    <tr key={m.id} className="hover:bg-stone-50/50">
                      <td className="px-5 py-3.5 text-xs text-[#78716c]">
                        {formatDateTimeId(m.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-[#272727]">
                        {m.productName}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-700">
                          {m.movementType}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right font-mono font-bold ${
                          m.qtyChange > 0
                            ? "text-emerald-600"
                            : m.qtyChange < 0
                            ? "text-rose-600"
                            : "text-[#78716c]"
                        }`}
                      >
                        {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-[#272727]">
                        {m.availableAfter}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-stone-600">
                        {m.reason || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Format Laporan Resmi Penjualan Restoran (Siap Cetak / Ekspor PDF) */}
      {isPdfModalOpen && (
        <ModalFrame
          title={`Dokumen Laporan Resmi Penjualan: ${report.rangeLabel}`}
          onClose={() => setIsPdfModalOpen(false)}
        >
          <div className="space-y-6">
            {/* Action Bar Modal */}
            <div className="flex items-center justify-between rounded-xl bg-[#F6F4F2] p-3 text-xs">
              <span className="text-[#78716c]">
                Pratinjau formulir cetak A4 resmi untuk pelaporan owner & manajerial.
              </span>
              <button
                type="button"
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#272727] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-black transition"
              >
                <Printer className="h-4 w-4 text-[#F16F62]" />
                Cetak ke PDF / Printer (A4)
              </button>
            </div>

            {/* Dokumen Laporan Kertas Standar (Siap Cetak window.print) */}
            <div
              id="printable-report-document"
              className="rounded-xl border border-stone-300 bg-white p-8 text-[#272727] shadow-sm print:border-none print:p-0 print:shadow-none"
            >
              {/* Kop Laporan Resmi */}
              <div className="border-b-2 border-stone-900 pb-4 text-center">
                <h2 className="text-xl font-black uppercase tracking-wider text-[#272727]">
                  {restaurantName}
                </h2>
                <p className="text-xs text-stone-600 font-medium">
                  LAPORAN REKAPITULASI PENJUALAN & OMZET OPERASIONAL
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Periode Laporan: <strong>{report.rangeLabel}</strong> | Dicetak pada: {formatDateTimeId(new Date().toISOString())}
                </p>
              </div>

              {/* Rangkuman Finansial Eksekutif */}
              <div className="my-6 grid grid-cols-3 gap-4 border border-stone-300 rounded-lg p-4 bg-stone-50/60 text-xs">
                <div>
                  <p className="text-stone-500 font-medium uppercase text-[10px]">Total Pesanan Selesai</p>
                  <p className="text-lg font-bold text-stone-900 mt-1">{report.summary.completedOrders} Transaksi</p>
                </div>
                <div>
                  <p className="text-stone-500 font-medium uppercase text-[10px]">Rata-rata Transaksi (AOV)</p>
                  <p className="text-lg font-bold text-stone-900 mt-1">{formatRupiah(report.summary.averageOrderValue)}</p>
                </div>
                <div>
                  <p className="text-stone-500 font-medium uppercase text-[10px]">Total Omzet Bersih (Net)</p>
                  <p className="text-lg font-bold text-[#F16F62] mt-1">{formatRupiah(report.summary.netSales)}</p>
                </div>
              </div>

              {/* Tabel Ringkasan Finansial Detail */}
              <div className="mb-6">
                <h5 className="text-xs font-bold uppercase tracking-wider text-stone-900 border-b border-stone-300 pb-1.5 mb-2">
                  1. Rekapitulasi Finansial
                </h5>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-stone-200">
                      <td className="py-1.5 text-stone-600">Total Penjualan Kotor (Subtotal Menu):</td>
                      <td className="py-1.5 text-right font-medium">{formatRupiah(report.summary.netSales)}</td>
                    </tr>
                    <tr className="border-b border-stone-200">
                      <td className="py-1.5 text-stone-600">Total Pajak Restoran (PB1 Terkumpul):</td>
                      <td className="py-1.5 text-right font-medium">{formatRupiah(report.summary.taxCollected)}</td>
                    </tr>
                    <tr className="border-b-2 border-stone-900 font-bold text-stone-900">
                      <td className="py-2">Total Pendapatan Bruto (Gross Revenue):</td>
                      <td className="py-2 text-right">{formatRupiah(report.summary.grossSales)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tabel Metode Pembayaran & Tipe Layanan */}
              <div className="mb-6 grid grid-cols-2 gap-6">
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-900 border-b border-stone-300 pb-1 mb-2">
                    2. Kanal Pembayaran
                  </h5>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-stone-500 text-[10px] border-b border-stone-200">
                        <th className="text-left py-1">Metode</th>
                        <th className="text-right py-1">Trx</th>
                        <th className="text-right py-1">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {report.paymentBreakdown.map((pm) => (
                        <tr key={pm.method}>
                          <td className="py-1 text-stone-700">{getPaymentMethodLabel(pm.method)}</td>
                          <td className="py-1 text-right text-stone-500 font-mono">{pm.count}</td>
                          <td className="py-1 text-right font-semibold">{formatRupiah(pm.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-900 border-b border-stone-300 pb-1 mb-2">
                    3. Tipe Layanan
                  </h5>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-stone-500 text-[10px] border-b border-stone-200">
                        <th className="text-left py-1">Layanan</th>
                        <th className="text-right py-1">Trx</th>
                        <th className="text-right py-1">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {report.serviceBreakdown.map((sb) => (
                        <tr key={sb.serviceType}>
                          <td className="py-1 text-stone-700">{getServiceTypeLabel(sb.serviceType)}</td>
                          <td className="py-1 text-right text-stone-500 font-mono">{sb.count}</td>
                          <td className="py-1 text-right font-semibold">{formatRupiah(sb.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabel Top 10 Menu Terlaris */}
              <div className="mb-8">
                <h5 className="text-xs font-bold uppercase tracking-wider text-stone-900 border-b border-stone-300 pb-1 mb-2">
                  4. Top 10 Menu Terlaris & Kontribusi
                </h5>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-stone-500 text-[10px] border-b border-stone-200">
                      <th className="text-left py-1">#</th>
                      <th className="text-left py-1">Menu</th>
                      <th className="text-left py-1">Kategori</th>
                      <th className="text-right py-1">Qty Terjual</th>
                      <th className="text-right py-1">Total Omzet</th>
                      <th className="text-right py-1">Pangsa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {report.productPerformance.slice(0, 10).map((item, idx) => (
                      <tr key={item.productId}>
                        <td className="py-1 text-stone-400 font-mono">{idx + 1}</td>
                        <td className="py-1 font-medium text-stone-800">{item.productName}</td>
                        <td className="py-1 text-stone-500 text-[11px]">{item.categoryName}</td>
                        <td className="py-1 text-right font-mono font-bold text-stone-800">{item.quantitySold}</td>
                        <td className="py-1 text-right font-semibold">{formatRupiah(item.totalRevenue)}</td>
                        <td className="py-1 text-right font-mono text-[11px] text-stone-600">
                          {item.sharePercentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tanda Tangan Pengesahan Laporan */}
              <div className="mt-12 pt-6 border-t border-stone-200 grid grid-cols-2 text-center text-xs">
                <div>
                  <p className="text-stone-500">Dibuat Oleh (Admin Toko):</p>
                  <div className="h-16" />
                  <p className="font-bold underline text-stone-900">Staf Administrasi</p>
                </div>
                <div>
                  <p className="text-stone-500">Disetujui Oleh (Owner Restoran):</p>
                  <div className="h-16" />
                  <p className="font-bold underline text-stone-900">Owner / Pengelola</p>
                </div>
              </div>
            </div>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}
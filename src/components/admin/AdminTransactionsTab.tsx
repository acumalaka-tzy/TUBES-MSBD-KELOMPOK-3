"use client";

import React, { useMemo, useState } from "react";
import {
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  ReceiptText,
  Search,
  ShoppingBag,
  Utensils,
  XCircle,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import type { ReportTransactionItem } from "@/lib/admin/types";
import { formatDateTimeId } from "./admin-ui";

interface AdminTransactionsTabProps {
  transactions: ReportTransactionItem[];
}

type PaymentStatusFilter = "ALL" | "PAID" | "PENDING_PAYMENT" | "CANCELLED";
type PaymentMethodFilter = "ALL" | "CASH" | "QRIS";

export function AdminTransactionsTab({ transactions }: AdminTransactionsTabProps) {
  const [search, setSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("ALL");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>("ALL");

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (paymentStatusFilter !== "ALL" && tx.paymentStatus !== paymentStatusFilter) {
        return false;
      }
      if (paymentMethodFilter !== "ALL" && tx.paymentMethod !== paymentMethodFilter) {
        return false;
      }
      if (q) {
        return (
          tx.orderNumber.toLowerCase().includes(q) ||
          tx.customerName.toLowerCase().includes(q) ||
          tx.customerPhone.toLowerCase().includes(q) ||
          (tx.tableNumber && tx.tableNumber.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [transactions, search, paymentStatusFilter, paymentMethodFilter]);

  // Metrik Cepat Transaksi
  const totalCount = transactions.length;
  const paidTransactions = transactions.filter((t) => t.paymentStatus === "PAID");
  const totalPaidRevenue = paidTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalCashRevenue = paidTransactions
    .filter((t) => t.paymentMethod === "CASH")
    .reduce((acc, t) => acc + t.totalAmount, 0);
  const totalQrisRevenue = paidTransactions
    .filter((t) => t.paymentMethod === "QRIS")
    .reduce((acc, t) => acc + t.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* 1. Metric Cards Header */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">Total Transaksi</span>
            <ReceiptText className="size-4 text-primary" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-foreground">{totalCount}</p>
          <span className="text-[11px] text-muted-foreground">Seluruh transaksi tercatat</span>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">Total Lunas</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-emerald-700">
            {formatRupiah(totalPaidRevenue)}
          </p>
          <span className="text-[11px] text-emerald-600">{paidTransactions.length} transaksi selesai</span>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">Penerimaan Tunai</span>
            <Banknote className="size-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono text-xl font-black text-amber-800">
            {formatRupiah(totalCashRevenue)}
          </p>
          <span className="text-[11px] text-muted-foreground">Uang fisik kasir</span>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">Penerimaan QRIS</span>
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-black text-sky-800">
              QRIS
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-black text-sky-700">
            {formatRupiah(totalQrisRevenue)}
          </p>
          <span className="text-[11px] text-muted-foreground">Settlement digital</span>
        </div>
      </div>

      {/* 2. Filter & Pencarian Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari no. pesanan, nama pelanggan, meja..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-secondary-bg/50 pl-9 pr-3 text-xs outline-none focus:border-primary focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Status Pembayaran */}
          <div className="inline-flex rounded-xl border border-border bg-[#F4F7F6] p-1">
            {(
              [
                { id: "ALL", label: "Semua" },
                { id: "PAID", label: "Lunas" },
                { id: "PENDING_PAYMENT", label: "Pending" },
                { id: "CANCELLED", label: "Batal" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setPaymentStatusFilter(s.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition cursor-pointer ${
                  paymentStatusFilter === s.id
                    ? "bg-[#0E2A2E] text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Filter Metode */}
          <div className="inline-flex rounded-xl border border-border bg-[#F4F7F6] p-1">
            {(
              [
                { id: "ALL", label: "Metode: Semua" },
                { id: "CASH", label: "Tunai" },
                { id: "QRIS", label: "QRIS" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethodFilter(m.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition cursor-pointer ${
                  paymentMethodFilter === m.id
                    ? "bg-[#0E2A2E] text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Tabel Riwayat Transaksi */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-[#F4F7F6] text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3.5">No. Pesanan</th>
                <th className="px-4 py-3.5">Waktu Transaksi</th>
                <th className="px-4 py-3.5">Pelanggan</th>
                <th className="px-4 py-3.5">Tipe &amp; Meja</th>
                <th className="px-4 py-3.5">Metode Bayar</th>
                <th className="px-4 py-3.5 text-center">Status Bayar</th>
                <th className="px-4 py-3.5 text-right">Subtotal</th>
                <th className="px-4 py-3.5 text-right">Pajak</th>
                <th className="px-4 py-3.5 text-right">Total Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <ReceiptText className="mx-auto size-8 text-muted-foreground/60 mb-2" />
                    <p className="font-bold text-sm">Tidak Ada Transaksi</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tidak ada data transaksi yang cocok dengan kriteria pencarian / filter ini.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isPaid = tx.paymentStatus === "PAID";
                  const isCancelled = tx.paymentStatus === "CANCELLED" || tx.orderStatus === "CANCELLED";

                  return (
                    <tr key={tx.id} className="transition-colors hover:bg-secondary-bg/50">
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-black text-foreground">{tx.orderNumber}</span>
                      </td>

                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                        {formatDateTimeId(tx.createdAt)}
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-bold text-foreground">{tx.customerName || "Pelanggan"}</p>
                        {tx.customerPhone && (
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {tx.customerPhone}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {tx.serviceType === "DINE_IN" ? (
                            <>
                              <Utensils className="size-3.5 text-primary" />
                              <span className="font-semibold text-foreground">
                                Dine In {tx.tableNumber ? `(Meja ${tx.tableNumber})` : ""}
                              </span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="size-3.5 text-amber-600" />
                              <span className="font-semibold text-foreground">Takeaway</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-black ${
                            tx.paymentMethod === "CASH"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-sky-100 text-sky-900"
                          }`}
                        >
                          {tx.paymentMethod === "CASH" ? "💵 TUNAI" : "📱 QRIS"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            isCancelled
                              ? "bg-red-500/10 text-red-700"
                              : isPaid
                                ? "bg-emerald-500/10 text-emerald-800"
                                : "bg-amber-500/15 text-amber-800"
                          }`}
                        >
                          {isCancelled
                            ? "Batal"
                            : isPaid
                              ? "Lunas"
                              : "Menunggu"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-medium text-muted-foreground">
                        {formatRupiah(tx.subtotal)}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                        {formatRupiah(tx.taxAmount)}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-sm font-black text-foreground">
                        {formatRupiah(tx.totalAmount)}
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


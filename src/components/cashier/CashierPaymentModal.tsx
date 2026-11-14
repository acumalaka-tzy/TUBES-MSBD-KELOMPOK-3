"use client";

import { useState, useTransition } from "react";
import {
  Banknote,
  Calculator,
  CheckCircle2,
  Printer,
  X,
  AlertCircle,
  Coins,
} from "lucide-react";
import type { CashierOrder } from "@/lib/cashier/types";
import { confirmCashPaymentAction } from "@/app/actions/cashier";

interface CashierPaymentModalProps {
  order: CashierOrder | null;
  onClose: () => void;
  onPaidSuccess: (updatedOrder: CashierOrder, shouldPrintReceipt: boolean) => void;
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

export function CashierPaymentModal({
  order,
  onClose,
  onPaidSuccess,
}: CashierPaymentModalProps) {
  const [amountPaidInput, setAmountPaidInput] = useState<string>(
    order ? String(order.totalAmount) : "0",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!order) return null;

  const totalDue = order.totalAmount;
  const numericPaid = Math.max(0, Math.round(Number(amountPaidInput.replace(/\D/g, "")) || 0));
  const changeAmount = numericPaid - totalDue;
  const isSufficient = numericPaid >= totalDue;

  // Tombol cepat wajib sesuai checklist: Uang Pas, Rp20.000, Rp50.000, Rp100.000
  const quickNominals = [
    { label: "Uang Pas", value: totalDue, highlight: true },
    { label: "Rp 20.000", value: 20000, highlight: false },
    { label: "Rp 50.000", value: 50000, highlight: false },
    { label: "Rp 100.000", value: 100000, highlight: false },
  ];

  // Jika tagihan > 100.000, tambahkan kelipatan bulat ke atas agar kasir tetap terbantu
  const nextFiftyMultiple = Math.ceil(totalDue / 50000) * 50000;
  if (totalDue > 100000 && nextFiftyMultiple > totalDue) {
    quickNominals.push({
      label: formatRupiah(nextFiftyMultiple),
      value: nextFiftyMultiple,
      highlight: false,
    });
  }

  const handleConfirm = (shouldPrintReceipt: boolean) => {
    setErrorMsg(null);
    if (!isSufficient) {
      setErrorMsg(
        `Nominal bayar kurang ${formatRupiah(Math.abs(changeAmount))} dari total tagihan.`,
      );
      return;
    }

    startTransition(async () => {
      const res = await confirmCashPaymentAction({
        orderNumber: order.orderNumber,
        amountPaid: numericPaid,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Gagal memproses pembayaran tunai.");
        return;
      }

      const updatedOrder: CashierOrder = {
        ...order,
        status: order.status === "PENDING" ? "CONFIRMED" : order.status,
        payment: {
          ...order.payment,
          method: "CASH",
          status: "PAID",
          amountPaid: numericPaid,
          changeAmount: res.changeAmount ?? changeAmount,
          paidAt: new Date().toISOString(),
        },
      };

      onPaidSuccess(updatedOrder, shouldPrintReceipt);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-border bg-[#0E2A2E] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                Pembayaran Tunai &amp; Kalkulator Kembalian
              </h3>
              <p className="text-xs text-white/75">
                {order.orderNumber} • {order.customerName} (
                {order.serviceType === "DINE_IN"
                  ? `Meja ${order.tableNumber || "-"}`
                  : "Takeaway"}
                )
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
            aria-label="Tutup modal pembayaran"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Ringkasan Tagihan */}
          <div className="rounded-2xl border border-border bg-[#F4F7F6] p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Subtotal ({order.items.reduce((s, i) => s + i.quantity, 0)} item)</span>
              <span className="font-semibold text-foreground">{formatRupiah(order.subtotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Pajak PB1</span>
              <span className="font-semibold text-foreground">{formatRupiah(order.taxAmount)}</span>
            </div>
            <div className="my-2.5 border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Total Tagihan (Amount Due)
              </span>
              <span className="text-2xl font-black text-[#0E2A2E]">
                {formatRupiah(totalDue)}
              </span>
            </div>
          </div>

          {/* Tombol Cepat Nominal Bayar */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Tombol Nominal Cepat
              </label>
              <span className="text-[11px] font-semibold text-primary">
                Klik 1x untuk isi otomatis
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {quickNominals.map((btn) => {
                const isSelected = numericPaid === btn.value;
                return (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setAmountPaidInput(String(btn.value));
                    }}
                    className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition ${
                      isSelected
                        ? "border-primary bg-primary text-white shadow-sm"
                        : btn.highlight
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/20"
                          : "border-border bg-white text-foreground hover:border-primary/40 hover:bg-muted/60"
                    }`}
                  >
                    <span className="text-xs font-extrabold">{btn.label}</span>
                    {btn.label === "Uang Pas" && (
                      <span
                        className={`mt-0.5 text-[10px] font-semibold ${
                          isSelected ? "text-white/90" : "text-emerald-700"
                        }`}
                      >
                        {formatRupiah(btn.value)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Manual Nominal Uang Diterima */}
          <div>
            <label
              htmlFor="cashier-amount-paid-input"
              className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-muted-foreground"
            >
              Nominal Uang Tunai Diterima (Rp)
            </label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-4 font-mono text-sm font-extrabold text-muted-foreground">
                Rp
              </span>
              <input
                id="cashier-amount-paid-input"
                type="text"
                inputMode="numeric"
                value={numericPaid > 0 ? numericPaid.toLocaleString("id-ID") : ""}
                onChange={(e) => {
                  setErrorMsg(null);
                  const raw = e.target.value.replace(/\D/g, "");
                  setAmountPaidInput(raw || "0");
                }}
                placeholder="Masukkan nominal uang diterima..."
                className="w-full rounded-xl border border-border bg-white py-3 pr-4 pl-11 font-mono text-lg font-black text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Box Hasil Kalkulasi Kembalian Otomatis */}
          <div
            className={`rounded-2xl border p-4 transition ${
              isSufficient
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-amber-500/40 bg-amber-500/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isSufficient
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {isSufficient ? (
                    <Coins className="h-5 w-5" />
                  ) : (
                    <Calculator className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p
                    className={`text-xs font-extrabold uppercase tracking-wider ${
                      isSufficient ? "text-emerald-900" : "text-amber-900"
                    }`}
                  >
                    {isSufficient ? "Uang Kembalian Pelanggan" : "Nominal Belum Mencukupi"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatRupiah(numericPaid)} dikurangi {formatRupiah(totalDue)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`font-mono text-2xl font-black ${
                    isSufficient ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {isSufficient
                    ? formatRupiah(changeAmount)
                    : `- ${formatRupiah(Math.abs(changeAmount))}`}
                </p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-xs font-bold text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Tombol Konfirmasi */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border bg-[#F4F7F6] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => handleConfirm(false)}
            disabled={isPending || !isSufficient}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-white px-4 py-2.5 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isPending ? "Memproses..." : "Tandai Lunas Saja"}</span>
          </button>
          <button
            type="button"
            onClick={() => handleConfirm(true)}
            disabled={isPending || !isSufficient}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            <span>
              {isPending ? "Memproses..." : "Konfirmasi Lunas & Cetak Struk"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

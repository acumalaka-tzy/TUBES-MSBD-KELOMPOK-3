"use client";

import React from "react";
import { Banknote, CreditCard, ShieldCheck, Zap } from "lucide-react";

export type PaymentMethodOption = "CASH" | "MIDTRANS" | "QRIS" | "VIRTUAL_ACCOUNT";

interface PaymentSelectorProps {
  paymentMethod: PaymentMethodOption;
  onPaymentMethodChange: (method: "CASH" | "MIDTRANS") => void;
}

export function PaymentSelector({
  paymentMethod,
  onPaymentMethodChange,
}: PaymentSelectorProps) {
  // Normalisasi jika bernilai legacy QRIS / VIRTUAL_ACCOUNT ke MIDTRANS
  const isNonCash =
    paymentMethod === "MIDTRANS" ||
    paymentMethod === "QRIS" ||
    paymentMethod === "VIRTUAL_ACCOUNT";

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs space-y-5 sm:space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
            2
          </span>
          Metode Pembayaran
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pilih salah satu dari 2 metode pembayaran yang tersedia
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* 1. TUNAI / CASH */}
        <label
          className={`relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
            paymentMethod === "CASH"
              ? "border-emerald-600 bg-emerald-500/5 shadow-xs ring-2 ring-emerald-500/20"
              : "border-border hover:bg-secondary-bg/60"
          }`}
        >
          <input
            type="radio"
            name="paymentMethod"
            value="CASH"
            checked={paymentMethod === "CASH"}
            onChange={() => onPaymentMethodChange("CASH")}
            className="sr-only"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
              Di Kasir
            </span>
          </div>
          <span className="text-base font-bold text-foreground">Tunai</span>
          <span className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Bayar tunai langsung dengan uang fisik di meja kasir setelah pesanan dibuat.
          </span>
        </label>

        {/* 2. NON-TUNAI / MIDTRANS */}
        <label
          className={`relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
            isNonCash
              ? "border-primary bg-primary/5 shadow-xs ring-2 ring-primary/20"
              : "border-border hover:bg-secondary-bg/60"
          }`}
        >
          <input
            type="radio"
            name="paymentMethod"
            value="MIDTRANS"
            checked={isNonCash}
            onChange={() => onPaymentMethodChange("MIDTRANS")}
            className="sr-only"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
              <Zap className="w-3 h-3 shrink-0" />
              Midtrans Otomatis
            </span>
          </div>
          <span className="text-base font-bold text-foreground">Non-Tunai</span>
          <span className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Bayar via Midtrans (QRIS GoPay, OVO, ShopeePay, Dana, serta Virtual Account BCA/BRI/Mandiri/BNI).
          </span>
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Terverifikasi otomatis 24/7</span>
          </div>
        </label>
      </div>
    </div>
  );
}

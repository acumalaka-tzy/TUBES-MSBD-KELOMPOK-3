"use client";

import React from "react";
import { QrCode, Banknote, CreditCard } from "lucide-react";

interface PaymentSelectorProps {
  paymentMethod: "CASH" | "QRIS" | "VIRTUAL_ACCOUNT";
  onPaymentMethodChange: (method: "CASH" | "QRIS" | "VIRTUAL_ACCOUNT") => void;
}

export function PaymentSelector({
  paymentMethod,
  onPaymentMethodChange,
}: PaymentSelectorProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
            2
          </span>
          Metode Pembayaran
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pilih cara pembayaran yang paling nyaman untuk Anda
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* QRIS */}
        <label
          className={`relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
            paymentMethod === "QRIS"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border hover:bg-secondary-bg/60"
          }`}
        >
          <input
            type="radio"
            name="paymentMethod"
            value="QRIS"
            checked={paymentMethod === "QRIS"}
            onChange={() => onPaymentMethodChange("QRIS")}
            className="sr-only"
          />
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
              Otomatis
            </span>
          </div>
          <span className="text-sm font-bold text-foreground">QRIS Dinamis</span>
          <span className="text-[11px] text-muted-foreground mt-1">
            GoPay, OVO, Dana, ShopeePay, BCA, dll.
          </span>
        </label>

        {/* CASH / TUNAI */}
        <label
          className={`relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
            paymentMethod === "CASH"
              ? "border-primary bg-primary/5 shadow-xs"
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
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
              Kasir
            </span>
          </div>
          <span className="text-sm font-bold text-foreground">Bayar di Kasir</span>
          <span className="text-[11px] text-muted-foreground mt-1">
            Bayar tunai di meja kasir setelah pesanan dibuat.
          </span>
        </label>

        {/* VIRTUAL ACCOUNT */}
        <label
          className={`relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
            paymentMethod === "VIRTUAL_ACCOUNT"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border hover:bg-secondary-bg/60"
          }`}
        >
          <input
            type="radio"
            name="paymentMethod"
            value="VIRTUAL_ACCOUNT"
            checked={paymentMethod === "VIRTUAL_ACCOUNT"}
            onChange={() => onPaymentMethodChange("VIRTUAL_ACCOUNT")}
            className="sr-only"
          />
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
              Transfer
            </span>
          </div>
          <span className="text-sm font-bold text-foreground">Virtual Account</span>
          <span className="text-[11px] text-muted-foreground mt-1">
            BCA, Mandiri, BNI, BRI.
          </span>
        </label>
      </div>
    </div>
  );
}

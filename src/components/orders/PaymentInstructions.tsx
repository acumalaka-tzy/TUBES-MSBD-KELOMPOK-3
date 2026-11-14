"use client";

import React from "react";
import { Clock, QrCode, Banknote, CheckCircle2 } from "lucide-react";

interface PaymentInstructionsProps {
  orderNumber: string;
  paymentMethod?: string;
  isPaid: boolean;
  isCancelled: boolean;
  totalAmount: number;
  timeLeft: string;
}

export function PaymentInstructions({
  orderNumber,
  paymentMethod,
  isPaid,
  isCancelled,
  totalAmount,
  timeLeft,
}: PaymentInstructionsProps) {
  return (
    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center justify-between">
        <span>Metode Pembayaran</span>
        <span className="font-mono text-primary font-extrabold text-base">
          Rp {totalAmount.toLocaleString("id-ID")}
        </span>
      </h2>

      {/* Jika Belum Lunas */}
      {!isPaid && !isCancelled && (
        <div className="space-y-4">
          {/* Countdown Timer */}
          {timeLeft && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <span className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Sisa Batas Bayar:
              </span>
              <span className="font-mono text-xs font-black text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded">
                {timeLeft}
              </span>
            </div>
          )}

          {/* Tampilan QRIS */}
          {paymentMethod === "QRIS" && (
            <div className="text-center p-4 bg-secondary-bg border border-border rounded-xl">
              <div className="w-40 h-40 bg-white p-2 border border-border rounded-xl mx-auto shadow-sm flex flex-col items-center justify-center">
                <QrCode className="w-32 h-32 text-foreground" />
              </div>
              <p className="text-xs font-bold text-foreground mt-3">
                Scan QRIS Dinamis Warkop Agam
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Mendukung GoPay, OVO, Dana, ShopeePay, BCA Mobile, dll.
              </p>
            </div>
          )}

          {/* Tampilan TUNAI */}
          {paymentMethod === "CASH" && (
            <div className="p-4 bg-secondary-bg border border-border rounded-xl text-center">
              <Banknote className="w-10 h-10 text-primary mx-auto mb-2" />
              <p className="text-xs font-bold text-foreground">
                Pembayaran Tunai di Kasir
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Tunjukkan nomor pesanan{" "}
                <strong className="text-foreground">{orderNumber}</strong> ke kasir
                untuk melunasi pesanan Anda.
              </p>
            </div>
          )}

          {/* Tampilan Virtual Account */}
          {paymentMethod === "VIRTUAL_ACCOUNT" && (
            <div className="p-4 bg-secondary-bg border border-border rounded-xl space-y-2">
              <p className="text-xs text-muted-foreground">Nomor Virtual Account:</p>
              <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-border font-mono font-bold text-sm">
                <span>8808 1234 5678 9001</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText("8808123456789001")}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  Salin
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Jika Sudah Lunas */}
      {isPaid && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-emerald-800">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-bold">Pembayaran Telah Diterima</p>
          <p className="text-xs text-emerald-700 mt-1">
            Pesanan Anda sudah masuk antrean dapur dan sedang disiapkan.
          </p>
        </div>
      )}
    </div>
  );
}


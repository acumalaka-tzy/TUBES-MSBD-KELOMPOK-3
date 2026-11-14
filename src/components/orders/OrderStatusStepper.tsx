"use client";

import React from "react";
import {
  Clock,
  CheckCircle2,
  ChefHat,
  BellRing,
  Coffee,
  ShieldAlert,
} from "lucide-react";

interface OrderStatusStepperProps {
  status: string;
  notes?: string | null;
}

const steps = [
  {
    key: "PENDING",
    label: "Menunggu",
    detail: "Menunggu konfirmasi pembayaran atau verifikasi kasir.",
    icon: Clock,
  },
  {
    key: "CONFIRMED",
    label: "Dikonfirmasi",
    detail: "Pembayaran diterima. Pesanan Anda sudah masuk antrean dapur.",
    icon: CheckCircle2,
  },
  {
    key: "PREPARING",
    label: "Disiapkan",
    detail: "Barista & dapur sedang meracik hidangan Anda dengan hangat.",
    icon: ChefHat,
  },
  {
    key: "READY",
    label: "Siap Saji",
    detail: "Hidangan sudah matang! Segera diantar ke meja atau siap diambil.",
    icon: BellRing,
  },
  {
    key: "COMPLETED",
    label: "Selesai",
    detail: "Pesanan telah disajikan. Terima kasih telah berkunjung ke Warkop Agam!",
    icon: Coffee,
  },
];

export function OrderStatusStepper({ status, notes }: OrderStatusStepperProps) {
  const currentStepIndex = steps.findIndex((s) => s.key === status);
  const safeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
  const isCancelled = status === "CANCELLED";
  const progressPercent = (safeIndex / (steps.length - 1)) * 100;
  const activeStep = steps[safeIndex];

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <div className="text-xs">
          <p className="font-bold">Pesanan Telah Dibatalkan</p>
          <p className="mt-0.5 text-red-600">
            {notes || "Pesanan dibatalkan atau waktu pembayaran telah kedaluwarsa."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        {/* Garis penghubung horizontal di belakang lingkaran tahap */}
        <div
          aria-hidden
          className="absolute left-[10%] right-[10%] top-5 h-1 rounded-full bg-border"
        />
        <div
          aria-hidden
          className="absolute left-[10%] top-5 h-1 rounded-full bg-gradient-to-r from-emerald-600 to-primary transition-all duration-500"
          style={{ width: `${progressPercent * 0.8}%` }}
        />

        <div className="relative grid grid-cols-5 gap-2">
          {steps.map((st, idx) => {
            const Icon = st.icon;
            const isCurrent = idx === safeIndex;
            const isPassed = idx < safeIndex;

            return (
              <div key={st.key} className="flex flex-col items-center text-center">
                <div
                  className={`relative z-10 mb-2 flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isPassed
                      ? "bg-emerald-600 text-white shadow-xs"
                      : isCurrent
                        ? "bg-primary text-white shadow-md ring-4 ring-primary/20 animate-pulse"
                        : "border border-border bg-secondary-bg text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <span
                  className={`text-[11px] font-semibold leading-tight ${
                    isCurrent
                      ? "font-bold text-primary"
                      : isPassed
                        ? "text-foreground"
                        : "text-muted-foreground/70"
                  }`}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Penjelasan tahap aktif */}
      {activeStep && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-[#FFF8F6] px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <activeStep.icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div>
              <p className="font-bold text-foreground">
                Tahap Saat Ini: <span className="text-primary">{activeStep.label}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">{activeStep.detail}</p>
            </div>
          </div>
          <span className="hidden shrink-0 rounded-full bg-white px-2.5 py-1 font-mono text-[10px] font-bold text-primary border border-primary/20 sm:inline-flex">
            {safeIndex + 1} / {steps.length}
          </span>
        </div>
      )}
    </div>
  );
}

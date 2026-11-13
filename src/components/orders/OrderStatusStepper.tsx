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
  { key: "PENDING", label: "Menunggu", icon: Clock },
  { key: "CONFIRMED", label: "Dikonfirmasi", icon: CheckCircle2 },
  { key: "PREPARING", label: "Disiapkan", icon: ChefHat },
  { key: "READY", label: "Siap Saji", icon: BellRing },
  { key: "COMPLETED", label: "Selesai", icon: Coffee },
];

export function OrderStatusStepper({ status, notes }: OrderStatusStepperProps) {
  const currentStepIndex = steps.findIndex((s) => s.key === status);
  const isCancelled = status === "CANCELLED";

  if (isCancelled) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
        <ShieldAlert className="w-5 h-5 shrink-0" />
        <div className="text-xs">
          <p className="font-bold">Pesanan Telah Dibatalkan</p>
          <p className="text-red-600 mt-0.5">
            {notes || "Pesanan dibatalkan atau waktu pembayaran telah kedaluwarsa."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-2 relative">
      {steps.map((st, idx) => {
        const Icon = st.icon;
        const isCurrent = idx === currentStepIndex;
        const isPassed = idx < currentStepIndex;

        return (
          <div key={st.key} className="flex flex-col items-center text-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition-all ${
                isPassed
                  ? "bg-emerald-600 text-white"
                  : isCurrent
                  ? "bg-primary text-white ring-4 ring-primary/20 animate-pulse"
                  : "bg-secondary-bg text-muted-foreground border border-border"
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span
              className={`text-[11px] leading-tight font-semibold ${
                isCurrent
                  ? "text-primary font-bold"
                  : isPassed
                  ? "text-foreground"
                  : "text-muted-foreground/60"
              }`}
            >
              {st.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

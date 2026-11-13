"use client";

import React from "react";
import { Sparkles, CheckCircle2, ChefHat } from "lucide-react";

interface OrderSimulationToolbarProps {
  status: string;
  isPaid: boolean;
  isProcessingAction: boolean;
  onSimulatePayment: () => void;
  onSimulateNextStep: () => void;
  onSimulateCancel: () => void;
}

export function OrderSimulationToolbar({
  status,
  isPaid,
  isProcessingAction,
  onSimulatePayment,
  onSimulateNextStep,
  onSimulateCancel,
}: OrderSimulationToolbarProps) {
  const isCancelled = status === "CANCELLED";
  const isCompleted = status === "COMPLETED";

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2 text-primary font-bold text-xs uppercase tracking-wider">
        <Sparkles className="w-4 h-4" />
        <span>Panel Pengujian Mandiri (Tubes)</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Gunakan tombol di bawah untuk menguji perubahan status database dan alur kasir/dapur secara instan:
      </p>

      <div className="space-y-2">
        {!isPaid && !isCancelled && (
          <button
            type="button"
            onClick={onSimulatePayment}
            disabled={isProcessingAction}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Simulasikan Pembayaran Lunas (PAID)
          </button>
        )}

        {!isCancelled && !isCompleted && (
          <button
            type="button"
            onClick={onSimulateNextStep}
            disabled={isProcessingAction}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <ChefHat className="w-3.5 h-3.5" />
            Simulasikan Status Dapur Selanjutnya
          </button>
        )}

        {!isCancelled && !isCompleted && (
          <button
            type="button"
            onClick={onSimulateCancel}
            disabled={isProcessingAction}
            className="w-full bg-white hover:bg-red-50 disabled:opacity-50 text-red-600 border border-red-200 text-xs font-bold py-2 px-3 rounded-xl transition-all"
          >
            Simulasikan Batalkan Pesanan (CANCELLED)
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  Banknote,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

interface PaymentInstructionsProps {
  orderNumber: string;
  paymentMethod?: string;
  isPaid: boolean;
  isCancelled: boolean;
  totalAmount: number;
  timeLeft: string;
  onPaymentSuccess?: () => void;
}

function loadSnapScript(clientKey: string, isProduction: boolean): Promise<Window["snap"]> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.snap?.pay) {
      return resolve(window.snap);
    }

    const snapUrl = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";

    const scriptId = "midtrans-snap-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = snapUrl;
      if (clientKey) {
        script.setAttribute("data-client-key", clientKey);
      }
      script.async = true;
      document.body.appendChild(script);
    }

    const checkInterval = setInterval(() => {
      if (window.snap?.pay) {
        clearInterval(checkInterval);
        resolve(window.snap);
      }
    }, 100);

    script.onload = () => {
      setTimeout(() => {
        clearInterval(checkInterval);
        if (window.snap?.pay) {
          resolve(window.snap);
        } else {
          resolve(window.snap);
        }
      }, 200);
    };

    script.onerror = (err) => {
      clearInterval(checkInterval);
      reject(err);
    };

    // Timeout 10 detik
    setTimeout(() => {
      clearInterval(checkInterval);
      if (window.snap?.pay) {
        resolve(window.snap);
      } else {
        reject(new Error("Timeout memuat script Midtrans Snap."));
      }
    }, 10000);
  });
}

export function PaymentInstructions({
  orderNumber,
  paymentMethod,
  isPaid,
  isCancelled,
  totalAmount,
  timeLeft,
  onPaymentSuccess,
}: PaymentInstructionsProps) {
  const [isLoadingSnap, setIsLoadingSnap] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: "success" | "info" | "error";
    message: string;
  } | null>(null);

  const isCash = paymentMethod === "CASH";
  const isNonCash = !isCash; // MIDTRANS, QRIS, VIRTUAL_ACCOUNT
  const isExpired = isCancelled || timeLeft === "Kedaluwarsa";

  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";
  const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";

  // Pre-load script snap.js hanya untuk pesanan non-tunai yang masih menunggu pembayaran
  useEffect(() => {
    if (!isNonCash || isPaid || isCancelled) return;
    void loadSnapScript(clientKey, isProduction).catch(() => {});
  }, [clientKey, isProduction, isNonCash, isPaid, isCancelled]);

  const handlePay = async () => {
    if (isExpired) {
      setStatusFeedback({
        type: "error",
        message: "Batas waktu pembayaran pesanan telah habis (Kedaluwarsa).",
      });
      return;
    }

    setIsLoadingSnap(true);
    setStatusFeedback(null);

    try {
      const res = await fetch("/api/payments/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      });
      const data = await res.json();

      if (!data.success || !data.token) {
        if (data.alreadyPaid && typeof onPaymentSuccess === "function") {
          setStatusFeedback({
            type: "success",
            message: data.error || "Pembayaran pesanan ini sudah diterima oleh Midtrans!",
          });
          onPaymentSuccess();
          setIsLoadingSnap(false);
          return;
        }
        setStatusFeedback({
          type: "error",
          message: data.error || "Gagal membuat sesi transaksi Midtrans.",
        });
        setIsLoadingSnap(false);
        return;
      }

      // Pastikan script Midtrans Snap sudah siap
      const activeClientKey = data.clientKey || clientKey;
      const activeIsProduction = data.isProduction ?? isProduction;
      const snapInstance = await loadSnapScript(activeClientKey, activeIsProduction);

      if (snapInstance?.pay) {
        snapInstance.pay(data.token, {
          onSuccess: async () => {
            setStatusFeedback({
              type: "success",
              message: "Pembayaran Anda berhasil diverifikasi oleh Midtrans!",
            });
            await handleCheckMidtransStatus();
          },
          onPending: async () => {
            setStatusFeedback({
              type: "info",
              message: "Menunggu penyelesaian pembayaran Anda di Midtrans.",
            });
            await handleCheckMidtransStatus();
          },
          onError: () => {
            setStatusFeedback({
              type: "error",
              message: "Pembayaran Midtrans dibatalkan atau gagal.",
            });
          },
          onClose: () => {
            // Popup ditutup oleh pengguna
          },
        });
      } else {
        setStatusFeedback({
          type: "error",
          message: "Gagal membuka jendela pembayaran Midtrans. Silakan coba lagi.",
        });
      }
    } catch (err) {
      setStatusFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Terjadi kesalahan saat memanggil Midtrans.",
      });
    } finally {
      setIsLoadingSnap(false);
    }
  };

  const handleCheckMidtransStatus = async () => {
    setIsCheckingStatus(true);
    setStatusFeedback(null);
    try {
      const res = await fetch("/api/payments/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.paymentStatus === "PAID") {
          setStatusFeedback({
            type: "success",
            message: "Pembayaran telah terverifikasi lunas oleh Midtrans!",
          });
          if (typeof onPaymentSuccess === "function") {
            onPaymentSuccess();
          }
        } else {
          setStatusFeedback({
            type: "info",
            message: data.message || `Status saat ini: ${data.midtransStatus || "Pending"}`,
          });
        }
      } else {
        setStatusFeedback({
          type: "error",
          message: data.error || "Gagal memverifikasi status pembayaran.",
        });
      }
    } catch (err) {
      setStatusFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Gagal mengecek status.",
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Metode Pembayaran
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isCash ? "Tunai (Bayar di Kasir)" : "Non-Tunai (Midtrans)"}
          </p>
        </div>
        <span className="shrink-0 font-mono text-primary font-black text-base sm:text-lg">
          Rp {totalAmount.toLocaleString("id-ID")}
        </span>
      </div>

      {/* Jika Belum Lunas */}
      {!isPaid && !isCancelled && (
        <div className="space-y-4">
          {/* Countdown Timer */}
          {timeLeft && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Sisa Batas Bayar:
              </span>
              <span className="font-mono text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">
                {timeLeft}
              </span>
            </div>
          )}

          {/* Tampilan TUNAI */}
          {isCash && (
            <div className="p-4 bg-muted/40 border border-border rounded-xl text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <Banknote className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-foreground">
                Pembayaran Tunai di Meja Kasir
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Silakan menuju meja kasir dan sebutkan nomor pesanan{" "}
                <strong className="text-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                  {orderNumber}
                </strong>{" "}
                untuk melunasi dengan uang tunai fisik.
              </p>
            </div>
          )}

          {/* Tampilan NON-TUNAI (MIDTRANS SNAP ASLI) */}
          {isNonCash && (
            <div className="space-y-3">
              <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      Pembayaran Non-Tunai Midtrans
                    </p>
                    <p className="text-xs text-muted-foreground">
                      QRIS (GoPay, OVO, Dana, ShopeePay) &amp; Virtual Account
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={isLoadingSnap || isExpired}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>
                      {isLoadingSnap
                        ? "Membuka Midtrans..."
                        : isExpired
                        ? "Waktu Bayar Habis (Kedaluwarsa)"
                        : "Bayar Sekarang"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckMidtransStatus}
                    disabled={isCheckingStatus || isExpired}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground font-bold text-xs hover:bg-muted transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? "animate-spin text-primary" : ""}`} />
                    <span>{isCheckingStatus ? "Mengecek..." : "Cek Status"}</span>
                  </button>
                </div>
              </div>

              {/* Banner jika batas waktu habis */}
              {isExpired && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                  <div>
                    <p className="font-bold">Batas Waktu Pembayaran Telah Habis</p>
                    <p className="text-[11px] text-red-700/80 dark:text-red-300/80 mt-0.5">
                      Pesanan ini telah kedaluwarsa secara otomatis dan meja telah dikosongkan. Silakan buat pesanan baru.
                    </p>
                  </div>
                </div>
              )}

              {/* Feedback status */}
              {statusFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    statusFeedback.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                      : statusFeedback.type === "error"
                      ? "bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300"
                      : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{statusFeedback.message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Jika Sudah Lunas */}
      {isPaid && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-emerald-800 dark:text-emerald-300 space-y-1">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <p className="text-sm font-bold">Pembayaran Telah Diterima</p>
          <p className="text-xs text-muted-foreground">
            {isCash ? "Lunas via Kasir" : "Lunas terverifikasi via Midtrans"} • Pesanan masuk antrean dapur.
          </p>
        </div>
      )}
    </div>
  );
}

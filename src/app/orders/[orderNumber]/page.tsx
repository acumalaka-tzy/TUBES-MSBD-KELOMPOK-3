"use client";

import React, { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import {
  getOrderDetail,
  simulatePaymentSuccess,
  simulateStatusUpdate,
} from "@/app/actions/checkout";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Banknote,
  UtensilsCrossed,
  ChefHat,
  BellRing,
  Coffee,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

function OrderTrackingContent({ params }: PageProps) {
  const resolvedParams = use(params);
  const orderNumber = resolvedParams.orderNumber;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await getOrderDetail(orderNumber);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        setError(res.error || "Pesanan tidak ditemukan.");
      }
    } catch (e: any) {
      setError(e.message || "Gagal memuat status pesanan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 6000); // Polling otomatis tiap 6 detik
    return () => clearInterval(interval);
  }, [orderNumber]);

  // Countdown Timer
  useEffect(() => {
    if (!order?.expires_at || order?.payment?.status === "PAID") return;

    const timer = setInterval(() => {
      const expiry = new Date(order.expires_at).getTime();
      const now = Date.now();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Kedaluwarsa");
        clearInterval(timer);
      } else {
        const minutes = Math.floor(diff / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes}m ${seconds < 10 ? "0" : ""}${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [order]);

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulatePayment = async () => {
    setIsProcessingAction(true);
    try {
      await simulatePaymentSuccess(orderNumber);
      await fetchOrder();
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSimulateNextStep = async () => {
    if (!order) return;
    const steps = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];
    const currentIndex = steps.indexOf(order.status);
    if (currentIndex >= 0 && currentIndex < steps.length - 1) {
      const nextStatus = steps[currentIndex + 1];
      setIsProcessingAction(true);
      try {
        await simulateStatusUpdate(orderNumber, nextStatus);
        await fetchOrder();
      } finally {
        setIsProcessingAction(false);
      }
    }
  };

  const handleSimulateCancel = async () => {
    setIsProcessingAction(true);
    try {
      await simulateStatusUpdate(orderNumber, "CANCELLED");
      await fetchOrder();
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-muted-foreground">
          Memuat status pesanan {orderNumber}...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Pesanan Tidak Ditemukan</h1>
        <p className="text-xs text-muted-foreground mt-2 mb-6">
          Nomor pesanan "{orderNumber}" tidak terdaftar atau telah kedaluwarsa.
        </p>
        <Link
          href="/checkout"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Checkout
        </Link>
      </div>
    );
  }

  const steps = [
    { key: "PENDING", label: "Menunggu", icon: Clock },
    { key: "CONFIRMED", label: "Dikonfirmasi", icon: CheckCircle2 },
    { key: "PREPARING", label: "Disiapkan", icon: ChefHat },
    { key: "READY", label: "Siap Saji", icon: BellRing },
    { key: "COMPLETED", label: "Selesai", icon: Coffee },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === "CANCELLED";
  const isPaid = order.payment?.status === "PAID";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Back & Refresh */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/checkout"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Pesan Lagi
        </Link>

        <button
          onClick={fetchOrder}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors bg-secondary-bg px-3 py-1.5 rounded-lg border border-border"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Sinkronkan
        </button>
      </div>

      {/* Panel Utama Nomor Pesanan */}
      <div className="bg-white border border-border rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-muted-foreground">
                Nomor Pesanan
              </span>
              <button
                onClick={handleCopyOrderNumber}
                className="text-muted-foreground hover:text-primary p-0.5"
                title="Salin Nomor Pesanan"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-2xl font-black text-foreground tracking-tight font-mono mt-0.5">
              {order.order_number}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Layanan */}
            <span className="px-3 py-1.5 rounded-xl bg-secondary-bg border border-border text-xs font-bold text-foreground flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-primary" />
              {order.service_type === "DINE_IN"
                ? `Dine In — Meja ${order.table?.table_number || "Aktif"}`
                : "Takeaway (Bungkus)"}
            </span>

            {/* Status Bayar Badge */}
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                isPaid
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : isCancelled
                  ? "bg-red-100 text-red-800 border border-red-200"
                  : "bg-amber-100 text-amber-800 border border-amber-200"
              }`}
            >
              {isPaid ? "LUNAS (PAID)" : isCancelled ? "DIBATALKAN" : "MENUNGGU PEMBAYARAN"}
            </span>
          </div>
        </div>

        {/* Visual Stepper Status */}
        <div className="pt-6">
          {isCancelled ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">Pesanan Telah Dibatalkan</p>
                <p className="text-red-600 mt-0.5">
                  {order.notes || "Pesanan dibatalkan atau waktu pembayaran telah kedaluwarsa."}
                </p>
              </div>
            </div>
          ) : (
            <div>
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
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* KOLOM KIRI: STATUS PEMBAYARAN & INSTRUKSI */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Metode Pembayaran</span>
              <span className="font-mono text-primary font-extrabold text-base">
                Rp {Number(order.total_amount).toLocaleString("id-ID")}
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
                {order.payment?.method === "QRIS" && (
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
                {order.payment?.method === "CASH" && (
                  <div className="p-4 bg-secondary-bg border border-border rounded-xl text-center">
                    <Banknote className="w-10 h-10 text-primary mx-auto mb-2" />
                    <p className="text-xs font-bold text-foreground">
                      Pembayaran Tunai di Kasir
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Tunjukkan nomor pesanan{" "}
                      <strong className="text-foreground">{order.order_number}</strong> ke kasir
                      untuk melunasi pesanan Anda.
                    </p>
                  </div>
                )}

                {/* Tampilan Virtual Account */}
                {order.payment?.method === "VIRTUAL_ACCOUNT" && (
                  <div className="p-4 bg-secondary-bg border border-border rounded-xl space-y-2">
                    <p className="text-xs text-muted-foreground">Nomor Virtual Account:</p>
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-border font-mono font-bold text-sm">
                      <span>8808 1234 5678 9001</span>
                      <button className="text-xs text-primary font-semibold">Salin</button>
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

          {/* PANEL SIMULASI & PENGUJIAN MANDIRI */}
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
                  onClick={handleSimulatePayment}
                  disabled={isProcessingAction}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Simulasikan Pembayaran Lunas (PAID)
                </button>
              )}

              {!isCancelled && order.status !== "COMPLETED" && (
                <button
                  type="button"
                  onClick={handleSimulateNextStep}
                  disabled={isProcessingAction}
                  className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  Simulasikan Status Dapur Selanjutnya
                </button>
              )}

              {!isCancelled && order.status !== "COMPLETED" && (
                <button
                  type="button"
                  onClick={handleSimulateCancel}
                  disabled={isProcessingAction}
                  className="w-full bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold py-2 px-3 rounded-xl transition-all"
                >
                  Simulasikan Batalkan Pesanan (CANCELLED)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: RINCIAN ITEM PESANAN */}
        <div className="md:col-span-7">
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider pb-3 border-b border-border">
              Rincian Item yang Dipesan
            </h2>

            <div className="divide-y divide-border my-2">
              {order.items?.map((item: any) => (
                <div key={item.id} className="py-3.5 flex justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">
                      {item.product_name_snapshot}
                    </p>

                    {item.options && item.options.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.options
                          .map((o: any) => `${o.option_name_snapshot}`)
                          .join(", ")}
                      </p>
                    )}

                    {item.item_notes && (
                      <p className="text-xs text-primary/80 italic mt-0.5">
                        "{item.item_notes}"
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground mt-1">
                      {item.quantity} x Rp {Number(item.unit_price_snapshot).toLocaleString("id-ID")}
                    </p>
                  </div>

                  <span className="font-mono text-sm font-bold text-foreground shrink-0">
                    Rp {Number(item.subtotal).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Rincian */}
            <div className="pt-4 border-t border-border space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono font-medium">
                  Rp {Number(order.subtotal).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Pajak Restoran (PB1 10%)</span>
                <span className="font-mono font-medium">
                  Rp {Number(order.tax_amount).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between text-foreground font-black text-base pt-2 border-t border-border">
                <span>Total Pembayaran</span>
                <span className="font-mono text-primary text-lg">
                  Rp {Number(order.total_amount).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Info Pemesan */}
            <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Pemesan:</strong> {order.customer_name} ({order.customer_phone})
              </p>
              {order.notes && (
                <p>
                  <strong>Catatan Pesanan:</strong> {order.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-muted-foreground font-semibold">Memuat pelacakan pesanan...</p>
        </div>
      }
    >
      <OrderTrackingContent {...props} />
    </Suspense>
  );
}

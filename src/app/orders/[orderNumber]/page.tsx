"use client";

import React, { useCallback, useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import {
  getOrderDetail,
  simulatePaymentSuccess,
  simulateStatusUpdate,
} from "@/actions";
import { OrderDetailData } from "@/actions/types";
import { OrderStatusStepper } from "@/components/orders/OrderStatusStepper";
import { PaymentInstructions } from "@/components/orders/PaymentInstructions";
import { OrderSimulationToolbar } from "@/components/orders/OrderSimulationToolbar";
import { OrderInvoice } from "@/components/orders/OrderInvoice";
import { useCart } from "@/context/cart-context";
import {
  UtensilsCrossed,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

function OrderTrackingContent({ params }: PageProps) {
  const resolvedParams = use(params);
  const orderNumber = resolvedParams.orderNumber;

  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [reorderSuccess, setReorderSuccess] = useState(false);
  const { addItem, openCart } = useCart();

  const handleReorder = () => {
    if (!order || !order.items || order.items.length === 0) return;

    for (const item of order.items) {
      addItem({
        productId: item.product_id || item.id,
        name: item.product_name_snapshot,
        unitPrice: Number(item.unit_price_snapshot),
        quantity: item.quantity,
        options: (item.options || []).map((o) => ({
          groupName: o.option_group_name_snapshot,
          optionName: o.option_name_snapshot,
          priceAdjustment: Number(o.price_adjustment_snapshot),
        })),
        itemNotes: item.item_notes || undefined,
      });
    }

    setReorderSuccess(true);
    setTimeout(() => setReorderSuccess(false), 3000);
    openCart();
  };

  const fetchOrder = useCallback(async () => {
    try {
      const res = await getOrderDetail(orderNumber);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        setError(res.error || "Pesanan tidak ditemukan.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat status pesanan.");
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchOrder();
    });
    const interval = setInterval(fetchOrder, 6000); // Polling otomatis tiap 6 detik
    return () => clearInterval(interval);
  }, [fetchOrder]);

  // Countdown Timer
  useEffect(() => {
    const expiresAt = order?.expires_at;
    if (!expiresAt || order?.payment?.status === "PAID") return;

    const timer = setInterval(() => {
      const expiry = new Date(expiresAt).getTime();
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
          Nomor pesanan &ldquo;{orderNumber}&rdquo; tidak terdaftar atau telah kedaluwarsa.
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

  const isCancelled = order.status === "CANCELLED";
  const isPaid = order.payment?.status === "PAID";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Back & Refresh */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/menu"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Pesan Menu Lagi
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
            <span className="px-3 py-1.5 rounded-xl bg-secondary-bg border border-border text-xs font-bold text-foreground flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-primary" />
              {order.service_type === "DINE_IN"
                ? `Dine In — Meja ${order.table?.table_number || "Aktif"}`
                : "Takeaway (Bungkus)"}
            </span>

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
          <OrderStatusStepper status={order.status} notes={order.notes} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* KOLOM KIRI: STATUS PEMBAYARAN & PANEL SIMULASI */}
        <div className="md:col-span-5 space-y-6">
          <PaymentInstructions
            orderNumber={order.order_number}
            paymentMethod={order.payment?.method}
            isPaid={isPaid}
            isCancelled={isCancelled}
            totalAmount={Number(order.total_amount)}
            timeLeft={timeLeft}
          />

          <OrderSimulationToolbar
            status={order.status}
            isPaid={isPaid}
            isProcessingAction={isProcessingAction}
            onSimulatePayment={handleSimulatePayment}
            onSimulateNextStep={handleSimulateNextStep}
            onSimulateCancel={handleSimulateCancel}
          />
        </div>

        {/* KOLOM KANAN: RINCIAN ITEM PESANAN */}
        <div className="md:col-span-7 space-y-4">
          <OrderInvoice order={order} />

          {/* Tombol Re-order (Pesan Lagi) */}
          <div className="bg-white border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground">Suka dengan hidangan ini?</p>
              <p className="text-[11px] text-muted-foreground">Pesan lagi seluruh menu di atas ke keranjang Anda</p>
            </div>
            <button
              type="button"
              onClick={handleReorder}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-primary-hover active:scale-[0.98] cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{reorderSuccess ? "✓ Ditambahkan ke Keranjang!" : "Pesan Lagi"}</span>
            </button>
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

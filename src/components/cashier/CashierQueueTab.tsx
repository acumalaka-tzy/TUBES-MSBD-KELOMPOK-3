"use client";

import { useState, useTransition } from "react";
import {
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock,
  Coffee,
  Banknote,
  Printer,
  QrCode,
  Sparkles,
  Utensils,
  ShoppingBag,
  XCircle,
  Volume2,
  ArrowRight,
  User,
  Phone,
  FileText,
} from "lucide-react";
import type { CashierOrder, QueueFilterKey } from "@/lib/cashier/types";
import {
  simulateIncomingWebOrderAction,
  updateOrderStatusCashierAction,
} from "@/app/actions/cashier";
import { simulatePaymentSuccess } from "@/actions/payments";

interface CashierQueueTabProps {
  orders: CashierOrder[];
  searchQuery: string;
  onOpenCashModal: (order: CashierOrder) => void;
  onOpenReceiptModal: (order: CashierOrder) => void;
  onRefreshData: () => Promise<void>;
  onPlayAudioAlert: () => void;
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

function formatTimeAgo(iso: string): string {
  try {
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (diffSec < 60) return "Baru saja";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} jam lalu`;
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const ORDER_STATUS_META: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  PENDING: {
    label: "Menunggu Konfirmasi",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-800",
    dotClass: "bg-amber-500",
  },
  CONFIRMED: {
    label: "Dikonfirmasi",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-800",
    dotClass: "bg-blue-500",
  },
  PREPARING: {
    label: "Sedang Disiapkan",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-800",
    dotClass: "bg-purple-500",
  },
  READY: {
    label: "Siap Saji",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800",
    dotClass: "bg-emerald-500",
  },
  COMPLETED: {
    label: "Selesai",
    badgeClass: "border-neutral-400/30 bg-neutral-200/70 text-neutral-700",
    dotClass: "bg-neutral-500",
  },
  CANCELLED: {
    label: "Dibatalkan",
    badgeClass: "border-red-500/30 bg-red-500/10 text-red-800",
    dotClass: "bg-red-500",
  },
};

export function CashierQueueTab({
  orders,
  searchQuery,
  onOpenCashModal,
  onOpenReceiptModal,
  onRefreshData,
  onPlayAudioAlert,
  onNotify,
}: CashierQueueTabProps) {
  const [activeFilter, setActiveFilter] = useState<QueueFilterKey>("action");
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "WEB" | "POS">("ALL");
  const [confirmCancelOrderNo, setConfirmCancelOrderNo] = useState<string | null>(null);
  const [pendingOrderNo, setPendingOrderNo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Hitung jumlah tiap tab filter
  const counts = {
    action: orders.filter(
      (o) =>
        o.status === "PENDING" ||
        o.status === "CONFIRMED" ||
        (o.status !== "COMPLETED" && o.status !== "CANCELLED" && o.payment.status === "UNPAID"),
    ).length,
    preparing: orders.filter((o) => o.status === "PREPARING").length,
    ready: orders.filter((o) => o.status === "READY").length,
    done: orders.filter((o) => o.status === "COMPLETED" || o.status === "CANCELLED").length,
    all: orders.length,
  };

  // Filter pesanan berdasarkan tab, source, dan kata kunci pencarian
  const filteredOrders = orders.filter((o) => {
    if (sourceFilter !== "ALL" && o.source !== sourceFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = o.orderNumber.toLowerCase().includes(q);
      const matchName = o.customerName.toLowerCase().includes(q);
      const matchPhone = o.customerPhone.toLowerCase().includes(q);
      const matchTable = o.tableNumber?.toLowerCase().includes(q) ?? false;
      const matchItem = o.items.some((i) => i.name.toLowerCase().includes(q));
      if (!matchNo && !matchName && !matchPhone && !matchTable && !matchItem) return false;
    }

    if (activeFilter === "action") {
      return (
        o.status === "PENDING" ||
        o.status === "CONFIRMED" ||
        (o.status !== "COMPLETED" && o.status !== "CANCELLED" && o.payment.status === "UNPAID")
      );
    }
    if (activeFilter === "preparing") {
      return o.status === "PREPARING";
    }
    if (activeFilter === "ready") {
      return o.status === "READY";
    }
    if (activeFilter === "done") {
      return o.status === "COMPLETED" || o.status === "CANCELLED";
    }
    return true;
  });

  const handleQuickStatusUpdate = (
    orderNumber: string,
    nextStatus: string,
    releaseTable = false,
  ) => {
    setPendingOrderNo(orderNumber);
    startTransition(async () => {
      const res = await updateOrderStatusCashierAction({
        orderNumber,
        nextStatus,
        releaseTable,
      });
      setPendingOrderNo(null);
      setConfirmCancelOrderNo(null);

      if (res.success) {
        onNotify(res.message || `Status ${orderNumber} diperbarui ke ${nextStatus}.`, "success");
        await onRefreshData();
      } else {
        onNotify(res.error || "Gagal memperbarui status pesanan.", "error");
      }
    });
  };

  const handleSimulateWebhookPaid = (orderNumber: string) => {
    setPendingOrderNo(orderNumber);
    startTransition(async () => {
      const res = await simulatePaymentSuccess(orderNumber);
      setPendingOrderNo(null);
      if (res.success) {
        onNotify(
          `Webhook Pembayaran Digital (${orderNumber}) terverifikasi LUNAS! Status otomatis CONFIRMED.`,
          "success",
        );
        await onRefreshData();
      } else {
        onNotify(res.error || "Gagal menyimulasikan webhook pembayaran.", "error");
      }
    });
  };

  const handleSimulateWebOrder = () => {
    setPendingOrderNo("SIMULATE");
    startTransition(async () => {
      const res = await simulateIncomingWebOrderAction();
      setPendingOrderNo(null);
      if (res.success) {
        onPlayAudioAlert();
        onNotify(
          res.message || "Pesanan Web baru masuk ke antrean! Notifikasi suara dibunyikan.",
          "info",
        );
        setActiveFilter("action");
        await onRefreshData();
      } else {
        onNotify(res.error || "Gagal membuat simulasi pesanan web.", "error");
      }
    });
  };

  const filterTabs: {
    key: QueueFilterKey;
    label: string;
    count: number;
    badgeTone: string;
  }[] = [
    {
      key: "action",
      label: "Perlu Tindakan",
      count: counts.action,
      badgeTone: "bg-amber-500 text-white",
    },
    {
      key: "preparing",
      label: "Sedang Disiapkan",
      count: counts.preparing,
      badgeTone: "bg-purple-600 text-white",
    },
    {
      key: "ready",
      label: "Siap Saji",
      count: counts.ready,
      badgeTone: "bg-emerald-600 text-white",
    },
    {
      key: "done",
      label: "Selesai",
      count: counts.done,
      badgeTone: "bg-neutral-500 text-white",
    },
    {
      key: "all",
      label: "Semua",
      count: counts.all,
      badgeTone: "bg-[#0E2A2E] text-white",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header Control Bar: Filter Tabs & Audio Alert Demo */}
      <div className="rounded-2xl border border-border bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Tab Filter Utama sesuai Checklist */}
          <div className="flex flex-wrap items-center gap-2">
            {filterTabs.map((tab) => {
              const active = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-extrabold transition-all ${
                    active
                      ? "bg-[#0E2A2E] text-white shadow-sm"
                      : "border border-border bg-[#F4F7F6] text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-black ${
                      active ? "bg-primary text-white" : tab.badgeTone
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filter Sumber & Tombol Simulasi Pesanan Web Masuk + Audio Alert */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-[#F4F7F6] p-1">
              {(
                [
                  { id: "ALL", label: "Semua" },
                  { id: "WEB", label: "Web / QR" },
                  { id: "POS", label: "POS Kasir" },
                ] as const
              ).map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setSourceFilter(src.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    sourceFilter === src.id
                      ? "bg-white text-[#0E2A2E] shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onPlayAudioAlert();
                onNotify("Tes bunyi notifikasi pesanan masuk berhasil diputar.", "info");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
              title="Uji suara notifikasi kasir"
            >
              <Volume2 className="h-3.5 w-3.5 text-primary" />
              <span>Tes Nada</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateWebOrder}
              disabled={isPending && pendingOrderNo === "SIMULATE"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-primary-hover disabled:opacity-50"
            >
              <BellRing className="h-3.5 w-3.5 animate-bounce" />
              <span>
                {isPending && pendingOrderNo === "SIMULATE"
                  ? "Mengirim..."
                  : "+ Simulasi Pesanan Web Masuk"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Daftar Kartu Antrean Pesanan */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4F7F6] text-muted-foreground">
            <Coffee className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-extrabold text-foreground">
            Tidak Ada Pesanan pada Filter Ini
          </h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Belum ada pesanan untuk kategori{" "}
            <strong>{filterTabs.find((t) => t.key === activeFilter)?.label}</strong>. Anda dapat
            menekan tombol <strong>&ldquo;+ Simulasi Pesanan Web Masuk&rdquo;</strong> di atas untuk
            menguji antrean real-time &amp; notifikasi suara.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredOrders.map((order) => {
            const statusMeta = ORDER_STATUS_META[order.status] ?? {
              label: order.status,
              badgeClass: "border-border bg-muted text-foreground",
              dotClass: "bg-neutral-500",
            };
            const isPaid = order.payment.status === "PAID";
            const isCash = order.payment.method === "CASH";
            const isOrderBusy = isPending && pendingOrderNo === order.orderNumber;
            const isTerminal = order.status === "COMPLETED" || order.status === "CANCELLED";

            return (
              <div
                key={order.id}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-md ${
                  !isPaid && !isTerminal
                    ? "border-amber-500/40 ring-1 ring-amber-500/15"
                    : order.status === "READY"
                      ? "border-emerald-500/40 ring-1 ring-emerald-500/15"
                      : "border-border"
                }`}
              >
                <div>
                  {/* Baris Atas: Nomor Struk, Sumber, Tipe Layanan & Status */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/80 pb-3.5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-black text-[#0E2A2E]">
                          {order.orderNumber}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            order.source === "WEB"
                              ? "bg-indigo-500/10 text-indigo-700"
                              : "bg-[#0E2A2E]/10 text-[#0E2A2E]"
                          }`}
                        >
                          {order.source === "WEB" ? "WEB • QR" : "POS KASIR"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
                            order.serviceType === "DINE_IN"
                              ? "bg-primary/15 text-primary"
                              : "bg-amber-500/15 text-amber-800"
                          }`}
                        >
                          {order.serviceType === "DINE_IN" ? (
                            <>
                              <Utensils className="h-3 w-3" />
                              <span>Dine In • Meja {order.tableNumber || "-"}</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="h-3 w-3" />
                              <span>Takeaway / Bungkus</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-bold text-foreground">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {order.customerName}
                        </span>
                        {order.customerPhone && order.customerPhone !== "-" && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {order.customerPhone}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(order.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Badge Status Pesanan & Pembayaran */}
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${statusMeta.badgeClass}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${statusMeta.dotClass}`} />
                        {statusMeta.label}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          isPaid
                            ? "bg-emerald-500/15 text-emerald-800"
                            : "bg-amber-500/20 text-amber-900"
                        }`}
                      >
                        {order.payment.method} • {isPaid ? "LUNAS" : "BELUM BAYAR"}
                      </span>
                    </div>
                  </div>

                  {/* Daftar Item Pesanan */}
                  <div className="my-3.5 space-y-2">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-xl bg-[#F4F7F6] px-3.5 py-2.5 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-[#0E2A2E] px-1.5 font-mono text-[11px] font-black text-white">
                              {item.quantity}x
                            </span>
                            <span className="font-extrabold text-foreground">{item.name}</span>
                          </div>
                          {item.options.length > 0 && (
                            <div className="flex flex-wrap gap-1 pl-7 pt-0.5">
                              {item.options.map((opt, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-md border border-border bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                                >
                                  {opt.groupName}: {opt.optionName}
                                  {opt.priceAdjustment > 0
                                    ? ` (+${formatRupiah(opt.priceAdjustment)})`
                                    : ""}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.itemNotes && (
                            <p className="pl-7 text-[11px] font-semibold italic text-amber-800">
                              Catatan: &ldquo;{item.itemNotes}&rdquo;
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-xs font-extrabold text-foreground">
                          {formatRupiah(item.subtotal)}
                        </span>
                      </div>
                    ))}

                    {order.notes && (
                      <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-900">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                        <span>Catatan Pesanan: &ldquo;{order.notes}&rdquo;</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Kartu: Ringkasan Total & Tombol Update Cepat 1-2 Klik */}
                <div className="space-y-3 border-t border-border/80 pt-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      <span>Subtotal {formatRupiah(order.subtotal)}</span>
                      <span className="mx-1.5">•</span>
                      <span>PB1 {formatRupiah(order.taxAmount)}</span>
                      {isPaid && order.payment.changeAmount > 0 && (
                        <>
                          <span className="mx-1.5">•</span>
                          <span className="font-bold text-emerald-700">
                            Kembalian: {formatRupiah(order.payment.changeAmount)}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-bold uppercase text-muted-foreground">
                        Total:
                      </span>
                      <span className="font-mono text-lg font-black text-[#0E2A2E]">
                        {formatRupiah(order.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Baris Tombol Cepat 1-2 Klik */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 1. Tombol Pembayaran Tunai atau Webhook Digital */}
                      {!isPaid && !isTerminal && isCash && (
                        <button
                          type="button"
                          onClick={() => onOpenCashModal(order)}
                          disabled={isOrderBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Banknote className="h-4 w-4" />
                          <span>Terima Tunai &amp; Kembalian</span>
                        </button>
                      )}

                      {!isPaid && !isTerminal && !isCash && (
                        <button
                          type="button"
                          onClick={() => handleSimulateWebhookPaid(order.orderNumber)}
                          disabled={isOrderBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-extrabold text-indigo-800 transition hover:bg-indigo-500/20 disabled:opacity-50"
                          title="Sesuai PRD 6.4: Pembayaran digital diverifikasi oleh webhook gateway"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>Simulasi Webhook Lunas ({order.payment.method})</span>
                        </button>
                      )}

                      {/* 2. Tombol Progres Status 1-2 Klik */}
                      {order.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleQuickStatusUpdate(order.orderNumber, "CONFIRMED")}
                            disabled={isOrderBusy}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Konfirmasi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickStatusUpdate(order.orderNumber, "PREPARING")}
                            disabled={isOrderBusy}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-600/40 bg-purple-600/10 px-3 py-2 text-xs font-extrabold text-purple-800 transition hover:bg-purple-600/20 disabled:opacity-50"
                          >
                            <ChefHat className="h-3.5 w-3.5" />
                            <span>Langsung Masak</span>
                          </button>
                        </>
                      )}

                      {order.status === "CONFIRMED" && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusUpdate(order.orderNumber, "PREPARING")}
                          disabled={isOrderBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-purple-700 disabled:opacity-50"
                        >
                          <ChefHat className="h-4 w-4" />
                          <span>Mulai Siapkan (Preparing)</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {order.status === "PREPARING" && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusUpdate(order.orderNumber, "READY")}
                          disabled={isOrderBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-primary-hover disabled:opacity-50"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>Tandai Siap Saji (Ready)</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {order.status === "READY" && (
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickStatusUpdate(order.orderNumber, "COMPLETED", true)
                          }
                          disabled={isOrderBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E2A2E] px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-[#163d42] disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span>
                            Selesaikan Pesanan
                            {order.serviceType === "DINE_IN" ? " & Kosongkan Meja" : ""}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* 3. Tombol Cetak Struk & Batalkan */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenReceiptModal(order)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-foreground transition hover:border-primary/40 hover:bg-muted"
                        title="Cetak Struk Termal 58mm / 80mm"
                      >
                        <Printer className="h-3.5 w-3.5 text-primary" />
                        <span>Struk</span>
                      </button>

                      {!isTerminal && (
                        <>
                          {confirmCancelOrderNo === order.orderNumber ? (
                            <div className="inline-flex items-center gap-1 rounded-xl border border-red-500/40 bg-red-500/10 px-2 py-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickStatusUpdate(order.orderNumber, "CANCELLED", true)
                                }
                                disabled={isOrderBusy}
                                className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-extrabold text-white hover:bg-red-700"
                              >
                                Ya, Batalkan
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmCancelOrderNo(null)}
                                className="rounded-lg px-1.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                              >
                                Tidak
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmCancelOrderNo(order.orderNumber)}
                              disabled={isOrderBusy}
                              className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-2.5 py-2 text-xs font-bold text-red-600 transition hover:border-red-500/30 hover:bg-red-50"
                              title="Batalkan pesanan & kembalikan reservasi stok"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Batal</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

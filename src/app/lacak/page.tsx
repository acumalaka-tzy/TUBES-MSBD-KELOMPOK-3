"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  ReceiptText,
  RotateCw,
  Search,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { getCustomerRecentOrders, getOrderDetail } from "@/actions";
import { useCart } from "@/context/cart-context";
import { useRecentOrders, type RecentOrderSummary } from "@/lib/active-table";
import { cn, formatRupiah } from "@/lib/utils";

interface MergedOrderSummary {
  orderNumber: string;
  trackingToken?: string | null;
  totalAmount: number;
  status?: string;
  serviceType: string;
  tableNumber?: string | null;
  createdAt?: string;
  itemsSummary?: string;
}

type OrderFilterTab = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED";

const PROGRESS_STEPS = [
  { key: "PENDING", label: "Menunggu", icon: CreditCard },
  { key: "CONFIRMED", label: "Dikonfirmasi", icon: ReceiptText },
  { key: "PREPARING", label: "Disiapkan", icon: ChefHat },
  { key: "READY", label: "Siap / Selesai", icon: CheckCircle2 },
] as const;

function getStepIndex(status?: string): number {
  switch (status) {
    case "COMPLETED":
    case "READY":
      return 3;
    case "PREPARING":
      return 2;
    case "CONFIRMED":
      return 1;
    case "PENDING":
    default:
      return 0;
  }
}

function getStatusBadge(status?: string) {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
          Selesai
        </span>
      );
    case "READY":
      return (
        <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-800">
          Siap Diambil
        </span>
      );
    case "PREPARING":
      return (
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">
          Sedang Disiapkan
        </span>
      );
    case "CONFIRMED":
      return (
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
          Dikonfirmasi
        </span>
      );
    case "CANCELLED":
      return (
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800">
          Dibatalkan
        </span>
      );
    case "PENDING":
    default:
      return (
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
          Menunggu
        </span>
      );
  }
}

function mergeWithLocalOrders(
  dbOrders: MergedOrderSummary[],
  localOrders: RecentOrderSummary[],
  liveOverrides: Record<string, { status?: string; itemsSummary?: string }>,
): MergedOrderSummary[] {
  const seen = new Set<string>();
  const combined: MergedOrderSummary[] = [];

  for (const dbo of dbOrders) {
    seen.add(dbo.orderNumber);
    combined.push(dbo);
  }
  for (const lo of localOrders) {
    if (!seen.has(lo.orderNumber)) {
      seen.add(lo.orderNumber);
      const live = liveOverrides[lo.orderNumber];
      combined.push({
        orderNumber: lo.orderNumber,
        trackingToken: lo.trackingToken,
        totalAmount: lo.totalAmount,
        status: live?.status,
        itemsSummary: live?.itemsSummary,
        serviceType: lo.serviceType,
        tableNumber: lo.tableNumber,
        createdAt: lo.createdAt,
      });
    }
  }
  return combined;
}

export default function LacakPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dbOrders, setDbOrders] = useState<MergedOrderSummary[]>([]);
  const [liveOverrides, setLiveOverrides] = useState<
    Record<string, { status?: string; itemsSummary?: string }>
  >({});
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");
  const [filterTab, setFilterTab] = useState<OrderFilterTab>("ALL");
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderFeedback, setReorderFeedback] = useState<string | null>(null);

  const localOrders = useRecentOrders();
  const allOrders = useMemo(
    () => mergeWithLocalOrders(dbOrders, localOrders, liveOverrides),
    [dbOrders, localOrders, liveOverrides],
  );

  const { addItem, openCart } = useCart();

  const syncOrders = useCallback(async () => {
    setSyncing(true);
    try {
      const dbRes = await getCustomerRecentOrders();
      const fetchedDb = dbRes.success ? dbRes.orders : [];
      setDbOrders(fetchedDb);

      // Sinkronkan status live & ringkasan item bagi pesanan guest di perangkat
      const dbSet = new Set(fetchedDb.map((o) => o.orderNumber));
      const missingLocal = localOrders.filter((lo) => !dbSet.has(lo.orderNumber));
      if (missingLocal.length > 0) {
        const entries = await Promise.all(
          missingLocal.map(async (lo) => {
            try {
              const detail = await getOrderDetail(lo.orderNumber);
              if (detail.success && detail.data) {
                const summary = (detail.data.items ?? [])
                  .map((it) => `${it.quantity}x ${it.product_name_snapshot}`)
                  .join(", ");
                return [
                  lo.orderNumber,
                  { status: detail.data.status, itemsSummary: summary || undefined },
                ] as const;
              }
            } catch {
              // Abaikan kegagalan sinkron individual
            }
            return null;
          }),
        );
        const nextOverrides: Record<string, { status?: string; itemsSummary?: string }> = {};
        for (const entry of entries) {
          if (entry) nextOverrides[entry[0]] = entry[1];
        }
        if (Object.keys(nextOverrides).length > 0) {
          setLiveOverrides((prev) => ({ ...prev, ...nextOverrides }));
        }
      }

      setLastSyncedAt(
        new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      );
    } catch (err) {
      console.warn("Gagal sinkron DB orders:", err);
    } finally {
      setLoaded(true);
      setSyncing(false);
    }
  }, [localOrders]);

  useEffect(() => {
    queueMicrotask(() => {
      void syncOrders();
    });
    const timer = setInterval(() => {
      void syncOrders();
    }, 10000);
    return () => clearInterval(timer);
  }, [syncOrders]);

  const filteredOrders = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return allOrders.filter((o) => {
      const st = o.status ?? "PENDING";
      const matchTab =
        filterTab === "ALL"
          ? true
          : filterTab === "COMPLETED"
            ? st === "COMPLETED"
            : filterTab === "CANCELLED"
              ? st === "CANCELLED"
              : st !== "COMPLETED" && st !== "CANCELLED";
      if (!matchTab) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        (o.itemsSummary ?? "").toLowerCase().includes(q) ||
        (o.tableNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [allOrders, filterTab, historyQuery]);

  const counts = useMemo(() => {
    const activeCount = allOrders.filter(
      (o) => o.status !== "COMPLETED" && o.status !== "CANCELLED",
    ).length;
    const doneCount = allOrders.filter((o) => o.status === "COMPLETED").length;
    const cancelCount = allOrders.filter((o) => o.status === "CANCELLED").length;
    return {
      ALL: allOrders.length,
      ACTIVE: activeCount,
      COMPLETED: doneCount,
      CANCELLED: cancelCount,
    };
  }, [allOrders]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = orderNumber.trim().toUpperCase();
    if (!/^ORD-\d{8}-\d{3,}$/.test(value)) {
      setError("Format nomor pesanan tidak valid. Contoh: ORD-20261114-451");
      return;
    }
    setError(null);
    router.push(`/orders/${encodeURIComponent(value)}`);
  }

  const handleReorder = async (orderNum: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setReorderingId(orderNum);
    setReorderFeedback(null);
    try {
      const res = await getOrderDetail(orderNum);
      if (res.success && res.data?.items) {
        for (const item of res.data.items) {
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
        setReorderFeedback(`Menu dari ${orderNum} ditambahkan ke keranjang.`);
        openCart();
      } else {
        setReorderFeedback(`Detail menu untuk ${orderNum} tidak ditemukan.`);
      }
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      {/* Header Banner Espresso */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#231712] via-[#2F1E17] to-[#41281E] p-6 text-white shadow-lg sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/25 blur-3xl"
        />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-[#FFD7CD]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Live Order Tracker
            </span>
            <h1 className="mt-2.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Lacak Status Pesanan
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-white/75 sm:text-sm">
              Pantau konfirmasi pembayaran dan progres dapur pesanan Anda secara <em>real-time</em>.
            </p>
          </div>
          <Link
            href="/menu"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 self-start rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-md transition-all hover:bg-primary-hover sm:self-auto"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
            <span>Pesan Menu</span>
          </Link>
        </div>

        {/* Form Cari Nomor Struk Cepat */}
        <form onSubmit={submit} className="relative mt-6 border-t border-white/15 pt-5">
          <label
            htmlFor="lacak-order-input"
            className="mb-2 block text-xs font-bold text-white/90"
          >
            Cari dengan Nomor Struk / Pesanan
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="lacak-order-input"
                type="text"
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Contoh: ORD-20261114-451"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-white/20 bg-white pl-10 pr-4 font-mono text-xs font-bold uppercase text-foreground outline-none placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-xs font-bold text-white shadow-md transition-colors hover:bg-primary-hover cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span>Cek Status</span>
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs font-semibold text-[#FFB4AB]">
              {error}
            </p>
          )}
        </form>
      </div>

      {/* Feedback pesan reorder */}
      {reorderFeedback && (
        <div
          role="status"
          className="mt-4 flex items-center justify-between rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-xs font-semibold text-success"
        >
          <span>{reorderFeedback}</span>
          <button
            type="button"
            onClick={() => setReorderFeedback(null)}
            className="text-[11px] font-bold underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Panduan Tahapan Status Simpel */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {PROGRESS_STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              className="flex items-center gap-2.5 rounded-2xl border border-border bg-white px-3 py-2.5 shadow-2xs"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold text-muted-foreground">
                  Tahap {idx + 1}
                </p>
                <p className="truncate text-xs font-bold text-foreground">{step.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Daftar Riwayat atau Empty State */}
      <div className="mt-6">
        {!loaded && allOrders.length === 0 ? (
          <div className="rounded-3xl border border-border bg-white p-8 text-center shadow-xs">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <RotateCw className="h-5 w-5 animate-spin" aria-hidden />
            </div>
            <p className="text-sm font-bold text-foreground">Memuat riwayat pesanan...</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mengambil data pesanan perangkat dan akun Anda.
            </p>
          </div>
        ) : allOrders.length === 0 ? (
          <div className="rounded-3xl border border-border bg-white p-8 text-center shadow-xs">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShoppingBag className="h-8 w-8" aria-hidden />
            </div>
            <h2 className="text-lg font-bold text-foreground sm:text-xl">
              Anda Belum Memiliki Pesanan
            </h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Pesanan yang Anda buat melalui web atau akun ini akan muncul di sini sehingga mudah
              dipantau kapan saja dan dipesan ulang dalam 1 klik.
            </p>
            <div className="mt-6">
              <Link
                href="/menu"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-xs font-bold text-white shadow-md transition-all hover:bg-primary-hover sm:text-sm"
              >
                <UtensilsCrossed className="h-4 w-4" aria-hidden />
                <span>Pilih Menu Sekarang</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-white p-5 shadow-xs sm:p-6">
            <div className="flex flex-col gap-3 border-b border-border pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" aria-hidden />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Riwayat Pesanan ({allOrders.length})
                  </h2>
                  {lastSyncedAt && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                      Live · {lastSyncedAt}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void syncOrders()}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary-bg px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50 cursor-pointer"
                >
                  <RotateCw className={cn("h-3 w-3", syncing && "animate-spin")} aria-hidden />
                  <span>{syncing ? "Menyinkronkan..." : "Segarkan Status"}</span>
                </button>
              </div>

              <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
                {/* Filter Status Interaktif */}
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: "ALL", label: "Semua" },
                      { key: "ACTIVE", label: "Diproses" },
                      { key: "COMPLETED", label: "Selesai" },
                      { key: "CANCELLED", label: "Batal" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setFilterTab(t.key)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-bold transition-colors cursor-pointer",
                        filterTab === t.key
                          ? "bg-primary text-white shadow-2xs"
                          : "bg-secondary-bg text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label} ({counts[t.key]})
                    </button>
                  ))}
                </div>

                {/* Cari Cepat di Riwayat */}
                <div className="relative sm:w-56">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="text"
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    placeholder="Filter no. struk / menu..."
                    className="h-9 w-full rounded-xl border border-border bg-secondary-bg/50 pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Tidak ada pesanan pada kategori status ini.
              </p>
            ) : (
              <div className="mt-4 space-y-3.5">
                {filteredOrders.map((o) => {
                  const isCancelled = o.status === "CANCELLED";
                  const stepIdx = getStepIndex(o.status);

                  return (
                    <div
                      key={o.orderNumber}
                      className="rounded-2xl border border-border bg-secondary-bg/40 p-4 transition-all hover:border-primary/50 hover:bg-white hover:shadow-xs"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            {isCancelled ? (
                              <XCircle className="h-5 w-5 text-error" aria-hidden />
                            ) : (
                              <ReceiptText className="h-5 w-5" aria-hidden />
                            )}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-mono text-sm font-black text-foreground">
                                {o.orderNumber}
                              </p>
                              {getStatusBadge(o.status)}
                            </div>

                            {o.itemsSummary && (
                              <p className="mt-0.5 line-clamp-1 text-xs font-medium text-foreground/80">
                                {o.itemsSummary}
                              </p>
                            )}

                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {o.serviceType === "DINE_IN"
                                ? `Dine In${o.tableNumber ? ` • Meja ${o.tableNumber}` : ""}`
                                : "Takeaway"}{" "}
                              •{" "}
                              <strong className="font-mono font-semibold text-foreground">
                                {formatRupiah(o.totalAmount)}
                              </strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={(e) => handleReorder(o.orderNumber, e)}
                            disabled={reorderingId === o.orderNumber}
                            title="Pesan menu ini lagi"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-bold text-foreground shadow-2xs transition-all hover:border-primary hover:text-primary active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            {reorderingId === o.orderNumber ? (
                              <RotateCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <ShoppingBag className="h-3.5 w-3.5 text-primary" aria-hidden />
                            )}
                            <span>Pesan Lagi</span>
                          </button>

                          <Link
                            href={
                              o.trackingToken
                                ? `/orders/${o.orderNumber}?token=${encodeURIComponent(o.trackingToken)}`
                                : `/orders/${o.orderNumber}`
                            }
                            className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary px-3.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-primary-hover active:scale-95"
                          >
                            <span>Lihat Status</span>
                            <ArrowRight className="h-3 w-3" aria-hidden />
                          </Link>
                        </div>
                      </div>

                      {/* Mini Progress Bar Progres Pesanan */}
                      {!isCancelled && (
                        <div className="mt-3.5 grid grid-cols-4 gap-1.5 border-t border-border/60 pt-3">
                          {PROGRESS_STEPS.map((st, idx) => {
                            const done = idx <= stepIdx;
                            return (
                              <div key={st.key} className="space-y-1">
                                <div
                                  className={cn(
                                    "h-1.5 w-full rounded-full transition-colors",
                                    done ? "bg-primary" : "bg-border",
                                  )}
                                />
                                <p
                                  className={cn(
                                    "truncate text-[10px] font-semibold",
                                    done ? "text-foreground" : "text-muted-foreground",
                                  )}
                                >
                                  {st.label}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs">
              <span className="text-muted-foreground">Ingin menambah pesanan baru?</span>
              <Link
                href="/menu"
                className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
              >
                <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
                <span>Pilih Menu Baru</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

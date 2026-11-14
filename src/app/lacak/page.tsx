"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  ReceiptText,
  Search,
  UtensilsCrossed,
  ShoppingBag,
  ChevronDown,
  RotateCw,
  CheckCircle2,
} from "lucide-react";
import {
  getRecentOrders,
  type RecentOrderSummary,
} from "@/lib/active-table";
import { getCustomerRecentOrders, getOrderDetail, type CustomerRecentOrderSummary } from "@/actions";
import { useCart } from "@/context/cart-context";
import { formatRupiah } from "@/lib/utils";

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

export default function LacakPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<MergedOrderSummary[]>([]);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const { addItem, openCart } = useCart();

  useEffect(() => {
    queueMicrotask(async () => {
      setMounted(true);

      // 1. Ambil dari Local Storage
      const localOrders = getRecentOrders();

      // 2. Coba ambil dari Database Akun Pelanggan
      try {
        const dbRes = await getCustomerRecentOrders();
        if (dbRes.success && dbRes.orders.length > 0) {
          // Gabungkan DB orders & Local orders (utamakan DB)
          const seen = new Set<string>();
          const combined: MergedOrderSummary[] = [];

          for (const dbo of dbRes.orders) {
            seen.add(dbo.orderNumber);
            combined.push(dbo);
          }

          for (const lo of localOrders) {
            if (!seen.has(lo.orderNumber)) {
              seen.add(lo.orderNumber);
              combined.push({
                orderNumber: lo.orderNumber,
                trackingToken: lo.trackingToken,
                totalAmount: lo.totalAmount,
                serviceType: lo.serviceType,
                tableNumber: lo.tableNumber,
                createdAt: lo.createdAt,
              });
            }
          }

          setAllOrders(combined);
          return;
        }
      } catch (err) {
        console.warn("Gagal sinkron DB orders:", err);
      }

      // Fallback ke local orders saja
      setAllOrders(
        localOrders.map((lo) => ({
          orderNumber: lo.orderNumber,
          trackingToken: lo.trackingToken,
          totalAmount: lo.totalAmount,
          serviceType: lo.serviceType,
          tableNumber: lo.tableNumber,
          createdAt: lo.createdAt,
        }))
      );
    });
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = orderNumber.trim().toUpperCase();
    if (!/^ORD-\d{8}-\d{3,}$/.test(value)) {
      setError("Format nomor pesanan tidak valid. Contoh: ORD-20261113-451");
      return;
    }
    setError(null);
    router.push(`/orders/${encodeURIComponent(value)}`);
  }

  const handleReorder = async (orderNum: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setReorderingId(orderNum);
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
        openCart();
      }
    } finally {
      setReorderingId(null);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "COMPLETED":
        return <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Selesai</span>;
      case "READY":
        return <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">Siap Diambil</span>;
      case "PREPARING":
        return <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">Sedang Disiapkan</span>;
      case "CONFIRMED":
        return <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Dikonfirmasi</span>;
      case "CANCELLED":
        return <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">Dibatalkan</span>;
      case "PENDING":
      default:
        return <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Menunggu</span>;
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      {/* Header Halaman */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Lacak Status Pesanan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pantau status konfirmasi pembayaran dan progres pesanan secara <em>real-time</em>.
        </p>
      </div>

      {mounted && allOrders.length === 0 ? (
        /* KONDISI 1: BELUM MEMILIKI PESANAN */
        <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingBag className="h-8 w-8" />
          </div>

          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            Anda Belum Memiliki Pesanan
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground sm:text-sm">
            Saat ini belum ada riwayat pesanan di akun atau perangkat Anda. Silakan jelajahi katalog menu kami untuk mulai memesan hidangan favorit Anda.
          </p>

          <div className="mt-6">
            <Link
              href="/menu"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-xs sm:text-sm font-bold text-white shadow-md transition-all hover:bg-primary-hover cursor-pointer"
            >
              <UtensilsCrossed className="h-4 w-4" />
              <span>Pilih Menu Sekarang</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Form Pencarian Manual */}
          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs text-muted-foreground mb-3">
              Sudah memesan di kasir dan memiliki nomor struk?
            </p>
            <form onSubmit={submit} className="mx-auto max-w-md space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Contoh: ORD-20261113-451"
                  autoComplete="off"
                  className="h-11 flex-1 rounded-xl border border-border bg-secondary-bg px-4 font-mono text-xs sm:text-sm font-bold uppercase outline-none placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 text-xs font-bold text-white transition-colors hover:bg-foreground/90 shrink-0 cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Cari</span>
                </button>
              </div>
              {error && (
                <p role="alert" className="text-xs font-semibold text-destructive text-left">
                  {error}
                </p>
              )}
            </form>
          </div>
        </div>
      ) : (
        /* KONDISI 2: SUDAH MEMILIKI RIWAYAT PESANAN */
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-xs sm:p-7">
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Riwayat Pesanan Anda ({allOrders.length})
              </h2>
            </div>

            <div className="mt-4 space-y-3.5">
              {allOrders.map((o) => (
                <div
                  key={o.orderNumber}
                  className="rounded-xl border border-border bg-secondary-bg/50 p-4 transition-all hover:border-primary/50 hover:bg-white hover:shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ReceiptText className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono text-sm font-black text-foreground">
                            {o.orderNumber}
                          </p>
                          {getStatusBadge(o.status)}
                        </div>

                        {o.itemsSummary && (
                          <p className="text-xs text-foreground/80 font-medium line-clamp-1 mt-0.5">
                            {o.itemsSummary}
                          </p>
                        )}

                        <p className="text-xs text-muted-foreground mt-0.5">
                          {o.serviceType === "DINE_IN"
                            ? `Dine In${o.tableNumber ? ` • Meja ${o.tableNumber}` : ""}`
                            : "Takeaway"}{" "}
                          • <strong className="font-mono text-foreground font-semibold">{formatRupiah(o.totalAmount)}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Tombol Pesan Lagi (Re-order) */}
                      <button
                        type="button"
                        onClick={(e) => handleReorder(o.orderNumber, e)}
                        disabled={reorderingId === o.orderNumber}
                        title="Pesan menu ini lagi"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-bold text-foreground transition-all hover:border-primary hover:text-primary active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        {reorderingId === o.orderNumber ? (
                          <RotateCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span>Pesan Lagi</span>
                      </button>

                      {/* Tombol Lihat Status */}
                      <Link
                        href={
                          o.trackingToken
                            ? `/orders/${o.orderNumber}?token=${encodeURIComponent(o.trackingToken)}`
                            : `/orders/${o.orderNumber}`
                        }
                        className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold text-white transition-all hover:bg-primary-hover active:scale-95 cursor-pointer shadow-2xs"
                      >
                        <span>Lihat Status</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ingin memesan menu lain?</span>
              <Link
                href="/menu"
                className="inline-flex items-center gap-1 font-bold text-primary hover:underline cursor-pointer"
              >
                <UtensilsCrossed className="h-3.5 w-3.5" />
                <span>Pilih Menu Baru</span>
              </Link>
            </div>
          </div>

          {/* Opsi Tambahan: Cari Nomor Pesanan Lain */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-xs">
            <button
              type="button"
              onClick={() => setShowSearchForm(!showSearchForm)}
              className="flex w-full items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-primary" />
                Lacak Pesanan Lain dengan Nomor Struk
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showSearchForm ? "rotate-180" : ""}`}
              />
            </button>

            {showSearchForm && (
              <form onSubmit={submit} className="mt-4 pt-3 border-t border-border space-y-2.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Contoh: ORD-20261113-451"
                    className="h-11 flex-1 rounded-xl border border-border bg-secondary-bg px-4 font-mono text-xs sm:text-sm font-bold uppercase outline-none placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-xs font-bold text-white transition-colors hover:bg-primary-hover shrink-0 cursor-pointer"
                  >
                    <span>Cari</span>
                  </button>
                </div>
                {error && (
                  <p role="alert" className="text-xs font-semibold text-destructive">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

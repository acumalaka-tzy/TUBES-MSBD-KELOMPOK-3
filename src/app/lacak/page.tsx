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
} from "lucide-react";
import {
  getRecentOrders,
  type RecentOrderSummary,
} from "@/lib/active-table";
import { formatRupiah } from "@/lib/utils";

export default function LacakPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrderSummary[]>([]);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setRecentOrders(getRecentOrders());
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

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      {/* Header Halaman */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Lacak Status Pesanan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pantau status konfirmasi pembayaran dan progres masakan dapur secara <em>real-time</em>.
        </p>
      </div>

      {mounted && recentOrders.length === 0 ? (
        /* KONDISI 1: BELUM MEMILIKI PESANAN */
        <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingBag className="h-8 w-8" />
          </div>

          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            Anda Belum Memiliki Pesanan
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground sm:text-sm">
            Saat ini belum ada pesanan aktif di perangkat Anda. Silakan jelajahi katalog menu kami untuk mulai memesan hidangan favorit Anda.
          </p>

          <div className="mt-6">
            <Link
              href="/menu"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-xs sm:text-sm font-bold text-white shadow-md transition-all hover:bg-primary-hover"
            >
              <UtensilsCrossed className="h-4 w-4" />
              <span>Pilih Menu Sekarang</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Form Pencarian Manual (Bagi yang punya kode struk fisik) */}
          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs text-muted-foreground mb-3">
              Sudah memesan di kasir dan memiliki kode struk?
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
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 text-xs font-bold text-white transition-colors hover:bg-foreground/90 shrink-0"
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
                Riwayat Pesanan Anda ({recentOrders.length})
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {recentOrders.map((o) => (
                <Link
                  key={o.orderNumber}
                  href={
                    o.trackingToken
                      ? `/orders/${o.orderNumber}?token=${encodeURIComponent(o.trackingToken)}`
                      : `/orders/${o.orderNumber}`
                  }
                  className="group flex items-center justify-between rounded-xl border border-border bg-secondary-bg/60 p-4 transition-all hover:border-primary hover:bg-white hover:shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <ReceiptText className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-mono text-sm font-black text-foreground">
                        {o.orderNumber}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {o.serviceType === "DINE_IN"
                          ? `Dine In${o.tableNumber ? ` • Meja ${o.tableNumber}` : ""}`
                          : "Takeaway (Bungkus)"}{" "}
                        • <strong className="font-mono text-foreground font-semibold">{formatRupiah(o.totalAmount)}</strong>
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                    <span>Lihat Status</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ingin memesan lagi?</span>
              <Link
                href="/menu"
                className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
              >
                <UtensilsCrossed className="h-3.5 w-3.5" />
                <span>Tambah Pesanan Baru</span>
              </Link>
            </div>
          </div>

          {/* Opsi Tambahan: Cari Nomor Pesanan Lain */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-xs">
            <button
              type="button"
              onClick={() => setShowSearchForm(!showSearchForm)}
              className="flex w-full items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
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
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-xs font-bold text-white transition-colors hover:bg-primary-hover shrink-0"
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

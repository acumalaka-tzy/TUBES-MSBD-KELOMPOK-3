"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, ReceiptText, Search, UtensilsCrossed } from "lucide-react";
import { getRecentOrders, type RecentOrderSummary } from "@/lib/active-table";
import { formatRupiah } from "@/lib/utils";

export default function LacakPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrderSummary[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      setRecentOrders(getRecentOrders());
    });
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = orderNumber.trim().toUpperCase();
    if (!/^ORD-\d{8}-\d{3,}$/.test(value)) {
      setError("Format nomor pesanan tidak valid. Contoh: ORD-20261113-123");
      return;
    }
    setError(null);
    router.push(`/orders/${encodeURIComponent(value)}`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Search className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              Lacak Status Pesanan
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Pantau status pembayaran dan progres dapur secara <em>real-time</em>.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div>
            <label
              htmlFor="order-number"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Nomor Pesanan / Kode Struk
            </label>
            <input
              id="order-number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Contoh: ORD-20261113-451"
              autoComplete="off"
              aria-invalid={!!error}
              aria-describedby={error ? "order-number-error" : undefined}
              className="h-12 w-full rounded-xl border border-border bg-secondary-bg px-4 font-mono text-sm font-bold uppercase outline-none placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {error && (
            <p id="order-number-error" role="alert" className="text-xs font-semibold text-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-hover"
          >
            <span>Cek Status Pesanan</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </form>

        {recentOrders.length > 0 && (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" aria-hidden />
              Pesanan Terakhir di Perangkat Ini
            </h2>
            <div className="mt-3 space-y-2">
              {recentOrders.map((o) => (
                <Link
                  key={o.orderNumber}
                  href={
                    o.trackingToken
                      ? `/orders/${o.orderNumber}?token=${encodeURIComponent(o.trackingToken)}`
                      : `/orders/${o.orderNumber}`
                  }
                  className="flex items-center justify-between rounded-xl border border-border bg-secondary-bg/70 p-3.5 transition-all hover:border-primary hover:bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ReceiptText className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <p className="font-mono text-sm font-extrabold text-foreground">
                        {o.orderNumber}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {o.serviceType === "DINE_IN"
                          ? `Dine In${o.tableNumber ? ` • Meja ${o.tableNumber}` : ""}`
                          : "Takeaway (Bungkus)"}{" "}
                        • {formatRupiah(o.totalAmount)}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                    Lihat <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>Belum membuat pesanan?</span>
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
            Pilih Menu Sekarang
          </Link>
        </div>
      </div>
    </div>
  );
}

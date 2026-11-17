"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Map as MapIcon,
  MapPin,
  Search,
} from "lucide-react";
import { getCustomerRecentOrders, type CustomerRecentOrderSummary } from "@/actions";
import { OutletLocationGrid } from "@/components/restaurant/OutletLocationGrid";
import { getOrderHistoryScope, useRecentOrders } from "@/lib/active-table";
import { type RestaurantInfo } from "@/lib/menu-data";
import { buildOutletLinks, OUTLET_PROFILE } from "@/lib/restaurant-profile";
import {
  consumePendingScrollOnHome,
  smoothScrollToSection,
} from "@/lib/smooth-scroll";
import { formatRupiah } from "@/lib/utils";

/**
 * Kartu foto depan outlet Warkop Agam di Hero Beranda.
 * Saat ditekan, layar langsung bergulir secara smooth menuju seksi Lokasi & Peta (#info) di paling bawah halaman beranda.
 */
export function HeroStorefrontCard({ address }: { address: string }) {
  return (
    <a
      href="#info"
      onClick={(e) => {
        if (smoothScrollToSection("info", -72, 680)) {
          e.preventDefault();
          window.history.replaceState(null, "", "/#info");
        }
      }}
      title="Klik untuk melihat lokasi Warkop Agam di bagian bawah halaman"
      aria-label="Lihat lokasi Warkop Agam di bagian bawah halaman"
      className="animate-fade-scale-in group block mx-auto w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[440px] overflow-hidden rounded-2xl border border-border bg-white shadow-md transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl active:scale-[0.99] cursor-pointer"
    >
      <figure>
        <div className="relative aspect-[4/3] sm:aspect-[4/3.5] lg:aspect-[4/3.2] w-full overflow-hidden bg-secondary-bg">
          <Image
            src={OUTLET_PROFILE.storefrontImage}
            alt={OUTLET_PROFILE.storefrontAlt}
            fill
            priority
            sizes="(max-width: 768px) 95vw, 450px"
            className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
          />
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-xs transition-colors group-hover:bg-primary">
            <MapPin className="h-3 w-3" aria-hidden />
            <span>Lihat Lokasi</span>
          </span>
        </div>
        <figcaption className="border-t border-border p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs sm:text-sm font-extrabold text-foreground transition-colors group-hover:text-primary">
              {OUTLET_PROFILE.brandTitle}
            </p>
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary"
              aria-hidden
            />
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs leading-relaxed text-muted-foreground">
            {address}
          </p>
        </figcaption>
      </figure>
    </a>
  );
}

const ORDER_STEPS = [
  {
    number: "01",
    title: "Pilih Menu & Varian",
    desc: "Atur pilihan panas/dingin, tingkat pedas, cara masak Mie Aceh, atau topping sesuai selera.",
  },
  {
    number: "02",
    title: "Pesan Meja atau Bawa Pulang",
    desc: "Checkout lewat scan QR meja tanpa antre di kasir, bayar melalui QRIS atau tunai.",
  },
  {
    number: "03",
    title: "Pantau Progres Pesanan",
    desc: "Lihat status konfirmasi pembayaran dan proses masak dapur langsung dari ponsel Anda.",
  },
];

export function QuickTrackBanner() {
  const router = useRouter();
  const [orderInput, setOrderInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    resolved: boolean;
    userId: string | null;
    userName: string | null;
    dbOrders: CustomerRecentOrderSummary[];
  }>({
    resolved: false,
    userId: null,
    userName: null,
    dbOrders: [],
  });

  useEffect(() => {
    let active = true;
    const loadViewerOrders = async () => {
      try {
        const res = await getCustomerRecentOrders();
        if (!active) return;
        setViewer({
          resolved: true,
          userId: res.userId ?? null,
          userName: res.userName ?? null,
          dbOrders: res.success ? res.orders : [],
        });
      } catch {
        if (!active) return;
        setViewer((prev) => ({ ...prev, resolved: true }));
      }
    };
    void loadViewerOrders();
    const onFocus = () => void loadViewerOrders();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const orderScope = viewer.resolved ? getOrderHistoryScope(viewer.userId) : null;
  const scopedLocalOrders = useRecentOrders(orderScope);

  const recentOrders = useMemo(() => {
    if (!viewer.resolved) return [];
    const seen = new Set<string>();
    const merged: Array<{
      orderNumber: string;
      trackingToken?: string | null;
      totalAmount: number;
      serviceType: string;
      tableNumber?: string | null;
    }> = [];

    for (const dbo of viewer.dbOrders) {
      seen.add(dbo.orderNumber);
      merged.push(dbo);
    }
    for (const lo of scopedLocalOrders) {
      if (!seen.has(lo.orderNumber)) {
        seen.add(lo.orderNumber);
        merged.push(lo);
      }
    }
    return merged.slice(0, 2);
  }, [viewer.resolved, viewer.dbOrders, scopedLocalOrders]);

  function handleTrackSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = orderInput.trim().toUpperCase();
    if (!/^ORD-\d{8}-\d{3,}$/.test(cleaned)) {
      setError("Gunakan format nomor pesanan seperti ORD-20261114-001");
      return;
    }
    setError(null);
    router.push(`/orders/${encodeURIComponent(cleaned)}`);
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="grid overflow-hidden rounded-xl border border-border bg-white shadow-xs md:grid-cols-12">
        <div className="flex flex-col justify-between p-6 md:col-span-6 md:p-8">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
              Cara Pesan dari Meja
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Alur pemesanan ringkas untuk pengunjung Dine In maupun Takeaway.
            </p>

            <ol className="mt-6 space-y-4">
              {ORDER_STEPS.map((step) => (
                <li key={step.number} className="flex items-start gap-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary-bg font-mono text-xs font-bold text-primary">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <Link
              href="/menu"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover"
            >
              <span>Buka Daftar Menu</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between border-t border-border bg-[#1F1814] p-6 text-white md:col-span-6 md:border-l md:border-t-0 md:p-8">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold tracking-tight">Cek Status Pesanan</h2>
              <Link
                href="/lacak"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#E8C5B4] hover:text-white"
              >
                <span>Semua Riwayat</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-white/75">
              Masukkan nomor struk pesanan Anda untuk melihat status dapur dan konfirmasi kasir.
            </p>

            <form onSubmit={handleTrackSubmit} className="mt-4 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={orderInput}
                  onChange={(e) => {
                    setOrderInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Contoh: ORD-20261114-001"
                  className="h-11 flex-1 rounded-lg border border-white/15 bg-white px-3.5 font-mono text-xs font-bold uppercase text-foreground outline-none placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-xs font-bold text-white transition-colors hover:bg-primary-hover cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden />
                  <span>Cek Status</span>
                </button>
              </div>
              {error && (
                <p role="alert" className="text-[11px] font-semibold text-[#F4B6AC]">
                  {error}
                </p>
              )}
            </form>
          </div>

          <div className="mt-6 border-t border-white/15 pt-4">
            {recentOrders.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-white/65">
                  {viewer.userId
                    ? `Pesanan terakhir akun ${viewer.userName || "Anda"}:`
                    : "Pesanan terakhir tamu di perangkat ini:"}
                </p>
                {recentOrders.map((ord) => (
                  <Link
                    key={ord.orderNumber}
                    href={
                      ord.trackingToken
                        ? `/orders/${ord.orderNumber}?token=${encodeURIComponent(ord.trackingToken)}`
                        : `/orders/${ord.orderNumber}`
                    }
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/8 px-3.5 py-2.5 text-xs text-white transition-colors hover:border-primary hover:bg-white/12"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono font-bold text-white">{ord.orderNumber}</p>
                      <p className="text-[11px] text-white/75">
                        {ord.serviceType === "DINE_IN"
                          ? `Dine In${ord.tableNumber ? ` • Meja ${ord.tableNumber}` : ""}`
                          : "Takeaway"}{" "}
                        • {formatRupiah(ord.totalAmount)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-[#E8C5B4]">Lihat →</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/75">
                <span>Nomor pesanan tersimpan otomatis di perangkat ini setelah checkout.</span>
                <Link
                  href="/lacak"
                  className="shrink-0 font-bold text-[#E8C5B4] hover:text-white"
                >
                  Buka Lacak →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function RestaurantInfoSection({ restaurant }: { restaurant: RestaurantInfo }) {
  const { mapsUrl } = buildOutletLinks(restaurant);

  useEffect(() => {
    if (typeof window === "undefined") return;
    consumePendingScrollOnHome("info", -72, 680);
    const scrollIfHashInfo = () => {
      if (window.location.hash === "#info") {
        smoothScrollToSection("info", -72, 680);
      }
    };
    window.addEventListener("hashchange", scrollIfHashInfo);
    return () => {
      window.removeEventListener("hashchange", scrollIfHashInfo);
    };
  }, []);

  return (
    <section id="info" className="scroll-mt-20 border-t border-border bg-secondary-bg">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-primary uppercase">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              <span>Kunjungi Outlet</span>
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-[1.75rem]">
              Lokasi &amp; Outlet Kami
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Temukan posisi Warkop Agam Berdikari langsung di Google Maps, lihat foto outlet, atau hubungi kasir via WhatsApp.
            </p>
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-primary-hover"
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden />
            <span>Buka di Google Maps</span>
          </a>
        </div>

        <div className="mt-6">
          <OutletLocationGrid restaurant={restaurant} showStorefrontPreview />
        </div>
      </div>
    </section>
  );
}

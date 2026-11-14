"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  PlugZap,
  QrCode,
  Search,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { OpenStatus } from "@/components/open-status";
import { useRecentOrders } from "@/lib/active-table";
import { formatWhatsapp, type RestaurantInfo } from "@/lib/menu-data";
import { formatRupiah } from "@/lib/utils";

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
  const recentOrders = useRecentOrders().slice(0, 2);

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
                  Pesanan terakhir di perangkat ini:
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

const FACILITIES = [
  { icon: Wifi, label: "Wi-Fi Gratis" },
  { icon: QrCode, label: "Order QR Meja" },
  { icon: PlugZap, label: "Stop Kontak Tiap Meja" },
  { icon: UtensilsCrossed, label: "Dine In & Takeaway" },
];

export function RestaurantInfoSection({ restaurant }: { restaurant: RestaurantInfo }) {
  const [copiedField, setCopiedField] = useState<"address" | "whatsapp" | null>(null);

  async function handleCopy(field: "address" | "whatsapp", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 2500);
    } catch {
      // Clipboard diblokir browser
    }
  }

  const mapsQuery = encodeURIComponent(`Warkop Agam, ${restaurant.address}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const mapsEmbedUrl = `https://maps.google.com/maps?hl=id&q=${mapsQuery}&t=m&z=16&ie=UTF8&iwloc=&output=embed`;

  const waMessage = encodeURIComponent(
    `Halo ${restaurant.name}, saya ingin bertanya terkait pesanan atau ketersediaan meja.`,
  );
  const waUrl = `https://wa.me/${restaurant.whatsapp}?text=${waMessage}`;
  const formattedWa = formatWhatsapp(restaurant.whatsapp);

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
              Temukan posisi outlet langsung di peta Google Maps atau hubungi kasir via WhatsApp.
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

        <div className="mt-6 grid gap-5 lg:grid-cols-12">
          {/* Kartu Informasi Outlet */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-white p-6 shadow-xs lg:col-span-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-md bg-secondary-bg px-2.5 py-1 text-[11px] font-bold text-foreground">
                  Outlet Berdikari · Padang Bulan
                </span>
                <OpenStatus
                  openingHours={restaurant.openingHours}
                  forceClosed={!restaurant.isWebOrderingOpen}
                />
              </div>

              <h3 className="mt-3.5 text-xl font-extrabold tracking-tight text-foreground">
                {restaurant.name}
              </h3>

              <div className="mt-1.5 flex items-start justify-between gap-2">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {restaurant.address}
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy("address", restaurant.address)}
                  aria-label="Salin alamat"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-secondary-bg px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary cursor-pointer"
                >
                  {copiedField === "address" ? (
                    <>
                      <Check className="h-3 w-3 text-success" aria-hidden />
                      <span className="text-success">Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-5 space-y-3 border-t border-border pt-4 text-xs">
                <div className="flex items-center gap-2.5 text-foreground">
                  <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="font-semibold">{restaurant.openingHours}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>WhatsApp: {formattedWa}</span>
                  </a>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-secondary-bg px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary hover:text-white"
                    >
                      <MessageCircle className="h-3 w-3" aria-hidden />
                      <span>Chat</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy("whatsapp", formattedWa)}
                      aria-label="Salin nomor WhatsApp"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary-bg px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary cursor-pointer"
                    >
                      {copiedField === "whatsapp" ? (
                        <>
                          <Check className="h-3 w-3 text-success" aria-hidden />
                          <span className="text-success">Disalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" aria-hidden />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Fasilitas Outlet
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {FACILITIES.map((f) => {
                    const Icon = f.icon;
                    return (
                      <span
                        key={f.label}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary-bg px-2.5 py-1.5 text-[11px] font-medium text-foreground"
                      >
                        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                        <span>{f.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden />
                <span>Petunjuk Arah Menuju Lokasi</span>
              </a>
            </div>
          </div>

          {/* Embed Google Maps Asli Sesuai Alamat (Klik langsung membuka Google Maps) */}
          <div className="relative min-h-[340px] overflow-hidden rounded-xl border border-border bg-white shadow-xs lg:col-span-7">
            <iframe
              title={`Lokasi ${restaurant.name} di Google Maps`}
              src={mapsEmbedUrl}
              referrerPolicy="no-referrer-when-downgrade"
              className="pointer-events-none h-full min-h-[340px] w-full border-0"
            />
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Tekan untuk membuka lokasi di Google Maps"
              aria-label={`Buka lokasi ${restaurant.name} di Google Maps (${restaurant.address})`}
              className="absolute inset-0 z-10 block bg-transparent transition-colors hover:bg-black/[0.03]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

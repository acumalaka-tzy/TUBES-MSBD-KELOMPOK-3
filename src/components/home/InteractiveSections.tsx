"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  MapPin,
  MessageCircle,
  PlugZap,
  QrCode,
  ReceiptText,
  Search,
  Sparkles,
  Tag,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { OpenStatus } from "@/components/open-status";
import { useRecentOrders } from "@/lib/active-table";
import { formatWhatsapp, type Promo, type RestaurantInfo } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * 1. Promo Cards Interaktif (Model Voucher + Salin Kode)
 * ------------------------------------------------------------------------- */

export function PromoCardList({ promos }: { promos: Promo[] }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2500);
    } catch {
      // Clipboard diblokir browser
    }
  }

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {promos.map((p) => {
        const isCopied = p.code ? copiedCode === p.code : false;
        return (
          <div
            key={p.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-primary/25 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
          >
            <div className="flex items-start gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-warning text-white shadow-sm transition-transform group-hover:scale-105">
                <Tag className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold text-foreground">{p.title}</h3>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    {p.badge}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-primary/25 bg-[#FFF9F7] px-5 py-3">
              {p.code ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">Kode:</span>
                  <span className="rounded-lg border border-primary/30 bg-white px-2.5 py-1 font-mono text-xs font-extrabold tracking-wide text-primary">
                    {p.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(p.code!)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3 w-3 text-success" aria-hidden />
                        <span className="text-success">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-[11px] font-semibold text-primary">
                  Diskon otomatis hari ini
                </span>
              )}

              <Link
                href="/menu"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover"
              >
                <span>Gunakan Promo</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * 2. Alur Pesan & Lacak Pesanan Cepat di Homepage Main
 * ------------------------------------------------------------------------- */

const STEPS = [
  {
    icon: UtensilsCrossed,
    title: "Pilih Menu & Kustomisasi Varian",
    desc: "Tentukan level pedas, tingkat manis, suhu panas/es, atau tambah topping favorit.",
  },
  {
    icon: CreditCard,
    title: "Checkout QRIS atau Bayar Kasir",
    desc: "Tanpa antre di meja kasir — cocok untuk Dine In via QR maupun Takeaway.",
  },
  {
    icon: ReceiptText,
    title: "Pantau Progres Dapur Live",
    desc: "Cek kapan pesanan dikonfirmasi, dimasak dapur, hingga siap disajikan ke meja.",
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
    <section className="mx-auto w-full max-w-6xl px-4 pb-12">
      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
        <div className="grid md:grid-cols-12">
          {/* Kiri: Alur Pemesanan Visual */}
          <div className="flex flex-col justify-between p-6 md:col-span-6 md:p-8">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Cara Pesan Praktis
              </span>
              <h2 className="mt-2.5 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                Pesan dari Meja, Pantau Status Langsung
              </h2>

              <div className="mt-5 space-y-3.5">
                {STEPS.map((st, idx) => {
                  const Icon = st.icon;
                  return (
                    <div key={st.title} className="flex items-start gap-3.5">
                      <div className="relative flex flex-col items-center">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-xs font-black text-white shadow-xs">
                          {idx + 1}
                        </span>
                        {idx < STEPS.length - 1 && (
                          <span aria-hidden className="mt-1 h-5 w-px bg-border" />
                        )}
                      </div>
                      <div className="flex-1 rounded-2xl border border-border/80 bg-secondary-bg/45 px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                          <h3 className="text-xs font-bold text-foreground">{st.title}</h3>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          {st.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Link
                href="/menu"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-secondary-bg px-4 text-xs font-bold text-foreground transition-colors hover:bg-primary hover:text-white"
              >
                <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
                <span>Mulai Pesan Menu</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>

          {/* Kanan: Widget Lacak Espresso Kontras */}
          <div className="flex flex-col justify-between bg-gradient-to-br from-[#231712] via-[#2C1D17] to-[#3B261E] p-6 text-white md:col-span-6 md:p-8">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-[#FFD7CD]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
                  Live Tracker
                </span>
                <Link
                  href="/lacak"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#FF9B8E] hover:text-white"
                >
                  <span>Semua Riwayat</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>

              <h3 className="mt-3 text-lg font-extrabold tracking-tight">
                Lacak Pesanan Cepat
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-white/75">
                Masukkan nomor struk pesanan Anda untuk melihat status dapur &amp; pembayaran secara
                langsung.
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
                    placeholder="Contoh: ORD-20261114-101"
                    className="h-11 flex-1 rounded-xl border border-white/20 bg-white px-3.5 font-mono text-xs font-bold uppercase text-foreground outline-none placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-xs font-bold text-white shadow-md transition-colors hover:bg-primary-hover cursor-pointer"
                  >
                    <Search className="h-3.5 w-3.5" aria-hidden />
                    <span>Lacak</span>
                  </button>
                </div>
                {error && (
                  <p role="alert" className="text-[11px] font-semibold text-[#FFB4AB]">
                    {error}
                  </p>
                )}
              </form>
            </div>

            {/* Daftar cepat pesanan terbaru di perangkat */}
            <div className="mt-6 border-t border-white/15 pt-4">
              {recentOrders.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/65">
                    Pesanan Terakhir di Perangkat Ini
                  </p>
                  {recentOrders.map((ord) => (
                    <Link
                      key={ord.orderNumber}
                      href={
                        ord.trackingToken
                          ? `/orders/${ord.orderNumber}?token=${encodeURIComponent(ord.trackingToken)}`
                          : `/orders/${ord.orderNumber}`
                      }
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-xs text-white transition-all hover:border-primary hover:bg-white/15"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono font-bold text-white">{ord.orderNumber}</p>
                        <p className="text-[11px] text-white/75">
                          {ord.serviceType === "DINE_IN"
                            ? `Dine In${ord.tableNumber ? ` · Meja ${ord.tableNumber}` : ""}`
                            : "Takeaway"}{" "}
                          · {formatRupiah(ord.totalAmount)}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white">
                        Pantau <ArrowRight className="h-3 w-3" aria-hidden />
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/8 p-3.5 text-xs">
                  <div>
                    <p className="font-bold text-white">Belum ada pesanan aktif</p>
                    <p className="text-[11px] text-white/70">
                      Struk pesanan baru Anda otomatis muncul di halaman Lacak.
                    </p>
                  </div>
                  <Link
                    href="/lacak"
                    className="shrink-0 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-white hover:text-foreground"
                  >
                    Buka Lacak
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * 3. Info Restoran Interaktif (#info)
 * ------------------------------------------------------------------------- */

const FACILITIES = [
  { icon: Wifi, label: "Wi-Fi Gratis" },
  { icon: QrCode, label: "Meja QR Order" },
  { icon: PlugZap, label: "Stop Kontak Meja" },
  { icon: UtensilsCrossed, label: "Dine-In & Takeaway" },
];

export function RestaurantInfoSection({ restaurant }: { restaurant: RestaurantInfo }) {
  const [copiedField, setCopiedField] = useState<"address" | "whatsapp" | null>(null);

  async function handleCopy(field: "address" | "whatsapp", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 2500);
    } catch {
      // Clipboard tidak diizinkan
    }
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${restaurant.name} ${restaurant.address}`,
  )}`;

  const waMessage = encodeURIComponent(
    `Halo ${restaurant.name}, saya ingin bertanya terkait pesanan / reservasi meja.`,
  );

  return (
    <section id="info" className="scroll-mt-20 border-t border-border bg-secondary-bg">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-white px-3 py-1 text-[11px] font-bold text-primary">
              <MapPin className="h-3 w-3" aria-hidden />
              Kunjungi &amp; Hubungi Kami
            </span>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              Informasi Outlet &amp; Fasilitas
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Tempat nyaman untuk ngopi sanger, kerja santai, atau nongkrong malam di{" "}
              {restaurant.name}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-foreground/85">
            {FACILITIES.map((f) => {
              const Icon = f.icon;
              return (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 shadow-2xs"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {f.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {/* Card 1: Jam Operasional */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
                  <Clock className="h-5 w-5" aria-hidden />
                </span>
                <OpenStatus
                  openingHours={restaurant.openingHours}
                  forceClosed={!restaurant.isWebOrderingOpen}
                />
              </div>
              <h3 className="mt-4 text-sm font-extrabold text-foreground">Jam Operasional</h3>
              <p className="mt-1 font-mono text-xs font-bold text-foreground/90">
                {restaurant.openingHours}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {restaurant.isWebOrderingOpen
                  ? "Pemesanan online untuk Dine In & Takeaway sedang aktif hari ini."
                  : "Pemesanan web sementara ditutup. Silakan pesan langsung di meja kasir."}
              </p>
            </div>

            <div className="mt-4 border-t border-border/70 pt-3">
              <Link
                href="/menu"
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-bold",
                  restaurant.isWebOrderingOpen
                    ? "text-primary hover:text-primary-hover"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>Lihat Menu Tersedia</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>

          {/* Card 2: Lokasi Outlet Interaktif */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <span className="rounded-full bg-secondary-bg px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                  Outlet Utama
                </span>
              </div>
              <h3 className="mt-4 text-sm font-extrabold text-foreground">Alamat Outlet</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {restaurant.address}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
              >
                <span>Buka Google Maps</span>
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              <button
                type="button"
                onClick={() => handleCopy("address", restaurant.address)}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-secondary-bg/60 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary cursor-pointer"
              >
                {copiedField === "address" ? (
                  <>
                    <Check className="h-3 w-3 text-success" aria-hidden />
                    <span className="text-success">Alamat Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" aria-hidden />
                    <span>Salin Alamat</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 3: Kontak WhatsApp Kasir Interaktif */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 text-success">
                  <MessageCircle className="h-5 w-5" aria-hidden />
                </span>
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
                  Respon Cepat
                </span>
              </div>
              <h3 className="mt-4 text-sm font-extrabold text-foreground">Kontak WhatsApp Kasir</h3>
              <p className="mt-1 font-mono text-xs font-bold text-foreground">
                {formatWhatsapp(restaurant.whatsapp)}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Konfirmasi bukti pembayaran, pesanan rombongan, atau reservasi tempat duduk.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
              <a
                href={`https://wa.me/${restaurant.whatsapp}?text=${waMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-success px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-success/90"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                <span>Chat WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => handleCopy("whatsapp", formatWhatsapp(restaurant.whatsapp))}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-secondary-bg/60 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary cursor-pointer"
              >
                {copiedField === "whatsapp" ? (
                  <>
                    <Check className="h-3 w-3 text-success" aria-hidden />
                    <span className="text-success">Nomor Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" aria-hidden />
                    <span>Salin Nomor</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Strip ajakan bawah yang hangat sebelum footer */}
        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#231712] to-[#3A251D] p-5 text-white shadow-sm sm:flex-row sm:items-center sm:px-7">
          <div>
            <p className="text-sm font-extrabold">
              Siap ngopi Sanger atau nikmati Indomie Bangladesh hari ini?
            </p>
            <p className="mt-0.5 text-xs text-white/75">
              Pesan langsung dari meja tanpa antre dan pantau prosesnya secara live.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Link
              href="/menu"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
            >
              <span>Pesan Sekarang</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link
              href="/lacak"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white transition-colors hover:bg-white hover:text-foreground"
            >
              <span>Lacak Pesanan</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Coffee,
  CreditCard,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  QrCode,
  UtensilsCrossed,
} from "lucide-react";
import { OpenStatus } from "@/components/open-status";
import { OutletLocationGrid } from "@/components/restaurant/OutletLocationGrid";
import type { Product } from "@/lib/menu-data";
import { buildOutletLinks, OUTLET_PROFILE } from "@/lib/restaurant-profile";
import { getOutletSnapshot } from "@/lib/restaurant-snapshot";
import { formatRupiah } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Info Restoran — Warkop Agam Medan Berdikari",
  description:
    "Profil lengkap Warkop Agam Medan Outlet Berdikari di Jl. Berdikari Baru No. 21 B, Padang Bulan: jam buka 24 jam, daftar kategori menu, 40 meja QR, fasilitas, dan lokasi Google Maps.",
};

function priceRangeLabel(items: Product[]): string {
  if (items.length === 0) return "-";
  let min = items[0].basePrice;
  let max = items[0].basePrice;
  for (const item of items) {
    if (item.basePrice < min) min = item.basePrice;
    if (item.basePrice > max) max = item.basePrice;
  }
  return min === max ? formatRupiah(min) : `${formatRupiah(min)} – ${formatRupiah(max)}`;
}

async function InfoContent() {
  const { catalog, storeSettings, tableStats } = await getOutletSnapshot();
  const { categories, products, restaurant } = catalog;
  const { mapsUrl, waUrl, formattedWa } = buildOutletLinks(restaurant);

  const flaggedBest = products.filter((p) => p.bestSeller);
  const bestSellers = (flaggedBest.length > 0 ? flaggedBest : products).slice(0, 6);
  const taxText = storeSettings.taxEnabled ? `PB1 ${storeSettings.taxPercentage}%` : "0%";
  const taxSubText = storeSettings.taxEnabled
    ? "Tarif pajak restoran aktif"
    : "Tanpa tambahan pajak restoran";

  const metrics = [
    {
      label: "Jam Operasional",
      value: restaurant.openingHours.toLowerCase().includes("24 jam") ? "24 Jam" : "Setiap Hari",
      sub: restaurant.openingHours,
    },
    {
      label: "Sajian Tersedia",
      value: `${products.length} Menu`,
      sub: `${categories.length} kategori pilihan`,
    },
    {
      label: "Area Makan",
      value: `${tableStats.totalTables} Meja`,
      sub: `${tableStats.availableTables} kosong • ${tableStats.totalSeats} kursi`,
    },
    {
      label: "Pajak Restoran",
      value: taxText,
      sub: taxSubText,
    },
  ];

  return (
    <>
      {/* Hero & Profil Outlet Berdikari */}
      <section className="border-b border-border bg-secondary-bg text-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-8 sm:gap-8 sm:py-10 md:grid-cols-12 md:py-12">
          <div className="min-w-0 md:col-span-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-[11px] font-bold text-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <span>{OUTLET_PROFILE.outletBadge}</span>
              </span>
              <OpenStatus
                openingHours={restaurant.openingHours}
                forceClosed={!restaurant.isWebOrderingOpen}
              />
              <span className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {restaurant.isWebOrderingOpen
                  ? "Pemesanan Web Aktif"
                  : "Pemesanan Web Tutup Sementara"}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
              {restaurant.name} Medan <span className="text-primary">— Berdikari</span>
            </h1>

            <p className="mt-1.5 text-xs font-semibold text-primary sm:text-sm">
              &ldquo;{OUTLET_PROFILE.tagline}&rdquo; · {OUTLET_PROFILE.menuAddressNote}
            </p>

            <div className="mt-4 max-w-2xl space-y-2.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              <p>
                {restaurant.name} Outlet Berdikari berlokasi di {restaurant.address} dan melayani
                pelanggan {restaurant.openingHours.toLowerCase()}. Tersedia {products.length} menu
                khas warkop Medan dan Aceh dalam {categories.length} kategori, mulai dari Kopi
                Sanger, TST, Teh Tarik, dan Soda Badak hingga Indomie Bangladesh, Mie Aceh, Roti
                Cane, Nasi Goreng, serta Aneka Jus Segar.
              </p>
              <p>
                Pengunjung dapat menikmati Wi-Fi gratis serta stop kontak di area makan berkapasitas{" "}
                {tableStats.totalTables} meja ({tableStats.totalSeats} kursi), memesan langsung dari
                meja lewat scan QR atau Takeaway, lalu menyelesaikan pembayaran melalui Midtrans
                (QRIS, E-Wallet, Virtual Account) maupun tunai di kasir.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className="min-w-0 rounded-xl border border-border bg-white px-3 py-2.5 shadow-2xs sm:px-3.5 sm:py-3"
                >
                  <p className="text-[11px] font-semibold text-muted-foreground">{m.label}</p>
                  <p className="mt-0.5 text-base font-extrabold text-foreground sm:text-lg">
                    {m.value}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{m.sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <Link
                href="/menu"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                <span>Jelajahi {products.length} Menu</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <div className="grid grid-cols-2 gap-2.5 sm:contents">
                <Link
                  href="/checkout"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3.5 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary sm:px-4 sm:text-sm"
                >
                  <span>Pesan Sekarang</span>
                </Link>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3.5 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary sm:px-4 sm:text-sm"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          {/* Foto Resmi Outlet Warkop Agam Berdikari */}
          <div className="md:col-span-4">
            <figure className="mx-auto w-full max-w-[260px] overflow-hidden rounded-xl border border-border bg-white shadow-xs sm:max-w-[290px]">
              <div className="relative aspect-[3/4] w-full bg-secondary-bg">
                <Image
                  src={OUTLET_PROFILE.storefrontImage}
                  alt={OUTLET_PROFILE.storefrontAlt}
                  fill
                  priority
                  sizes="(max-width: 768px) 85vw, 300px"
                  className="object-cover"
                />
              </div>
              <figcaption className="border-t border-border p-3.5">
                <p className="text-xs font-extrabold text-foreground">
                  {OUTLET_PROFILE.brandTitle}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {restaurant.address}
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Tentang Sajian & Daftar Kategori Menu */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-primary uppercase">
              <Coffee className="h-3.5 w-3.5" aria-hidden />
              <span>Ragam Sajian</span>
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              Kategori Menu {restaurant.name} Berdikari
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Data kategori, jumlah hidangan, dan rentang harga diambil langsung dari katalog aktif.
            </p>
          </div>
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover"
          >
            <span>Lihat katalog lengkap</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => {
            const catProducts = products.filter((p) => p.categoryId === cat.id);
            const highlights = catProducts.slice(0, 3);
            return (
              <Link
                key={cat.id}
                href={`/menu?kategori=${cat.slug}`}
                className="group flex flex-col justify-between rounded-xl border border-border bg-white p-5 transition-colors hover:border-primary/60"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl" aria-hidden>
                      {cat.emoji}
                    </span>
                    <span className="rounded-md bg-secondary-bg px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                      {catProducts.length} menu
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-foreground group-hover:text-primary">
                    {cat.name}
                  </h3>
                  <p className="mt-1 font-mono text-[11px] font-semibold text-primary">
                    {priceRangeLabel(catProducts)}
                  </p>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {cat.description}
                  </p>

                  {highlights.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {highlights.map((item) => (
                        <span
                          key={item.id}
                          className="rounded-md bg-secondary-bg px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {item.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  <span>Pilih menu</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>

        {bestSellers.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-[#1F1814] p-5 text-white sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-[#E8C5B4] uppercase">
                  Favorit Pengunjung
                </p>
                <h3 className="mt-0.5 text-base font-extrabold tracking-tight sm:text-lg">
                  Hidangan Andalan di Outlet Berdikari
                </h3>
              </div>
              <Link
                href="/menu"
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#E8C5B4] hover:text-white"
              >
                <span>Pesan sekarang</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {bestSellers.map((item) => (
                <Link
                  key={item.id}
                  href={`/menu?kategori=${categories.find((c) => c.id === item.categoryId)?.slug ?? ""}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/12 bg-white/6 px-3.5 py-2.5 text-xs transition-colors hover:border-primary hover:bg-white/10"
                >
                  <span className="truncate font-semibold text-white">{item.name}</span>
                  <span className="shrink-0 font-mono font-bold text-[#E8C5B4]">
                    {formatRupiah(item.basePrice)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Operasional, Pembayaran & Kanal Resmi */}
      <section className="border-y border-border bg-secondary-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            Informasi Operasional &amp; Layanan
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Ketentuan meja, metode pembayaran, serta kanal resmi yang aktif pada outlet.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-primary">
                <QrCode className="h-4 w-4 shrink-0" aria-hidden />
                <h3 className="text-sm font-bold text-foreground">Meja &amp; Layanan</h3>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                Tersedia <strong className="text-foreground">{tableStats.totalTables} meja aktif</strong>{" "}
                (Meja 1 – Meja {tableStats.totalTables}) dengan kapasitas total{" "}
                <strong className="text-foreground">{tableStats.totalSeats} kursi</strong>. Saat ini{" "}
                <strong className="text-foreground">{tableStats.availableTables} meja tersedia</strong>{" "}
                dan {tableStats.occupiedTables} meja sedang digunakan.
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <span>Dine In (QR Meja) &amp; Takeaway</span>
              </p>
            </div>

            <div className="rounded-xl border border-border bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-primary">
                <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
                <h3 className="text-sm font-bold text-foreground">Pembayaran &amp; Batas Waktu</h3>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                Menerima pembayaran non-tunai melalui <strong className="text-foreground">Midtrans Snap</strong>{" "}
                (QRIS, E-Wallet, Virtual Account) serta pembayaran <strong className="text-foreground">Tunai di Kasir</strong>.
              </p>
              <ul className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
                <li>
                  • Batas bayar digital:{" "}
                  <strong className="text-foreground">{storeSettings.digitalExpiryMinutes} menit</strong>
                </li>
                <li>
                  • Batas konfirmasi tunai:{" "}
                  <strong className="text-foreground">{storeSettings.cashExpiryMinutes} menit</strong>
                </li>
                <li>
                  • Pajak Restoran (PB1):{" "}
                  <strong className="text-foreground">
                    {storeSettings.taxEnabled ? `${storeSettings.taxPercentage}%` : "0% (Nonaktif)"}
                  </strong>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-white p-5 shadow-2xs sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 text-primary">
                <Clock className="h-4 w-4 shrink-0" aria-hidden />
                <h3 className="text-sm font-bold text-foreground">Kontak &amp; Media Sosial</h3>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                Hubungi kasir untuk pertanyaan ketersediaan tempat atau ikuti pembaruan resmi Warkop
                Agam Medan:
              </p>
              <div className="mt-3 space-y-2 text-xs">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary-bg/60 px-3 py-2 font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <span>WhatsApp Kasir</span>
                  <span className="font-mono text-[11px]">{formattedWa}</span>
                </a>
                {OUTLET_PROFILE.socials.map((soc) => (
                  <a
                    key={soc.platform}
                    href={soc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary-bg/60 px-3 py-2 font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <span>{soc.platform}</span>
                    <span className="font-mono text-[11px]">{soc.handle}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Peta Google Maps & Kontak Lengkap */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-primary uppercase">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              <span>Peta &amp; Rute</span>
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-[1.75rem]">
              Lokasi {restaurant.name} Berdikari
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Klik peta untuk membuka navigasi langsung menuju outlet di Google Maps.
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
          <OutletLocationGrid restaurant={restaurant} />
        </div>
      </section>
    </>
  );
}

function InfoSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10" aria-hidden>
      <div className="h-64 animate-pulse rounded-xl bg-secondary-bg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl bg-secondary-bg" />
        ))}
      </div>
    </div>
  );
}

export default function InfoPage() {
  return (
    <Suspense fallback={<InfoSkeleton />}>
      <InfoContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  CreditCard,
  Flame,
  MapPin,
  QrCode,
  ReceiptText,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { HeroShowcase } from "@/components/home/HeroShowcase";
import {
  PromoCardList,
  QuickTrackBanner,
  RestaurantInfoSection,
} from "@/components/home/InteractiveSections";
import { ProductCard } from "@/components/product-card";
import { getCatalog } from "@/lib/catalog";
import { promos } from "@/lib/menu-data";

const CATEGORY_THEME_BY_SLUG: Record<string, { iconBg: string; borderHover: string }> = {
  "kopi-minuman-hangat": {
    iconBg: "bg-amber-100 text-amber-800",
    borderHover: "hover:border-amber-400",
  },
  "minuman-dingin-segar": {
    iconBg: "bg-sky-100 text-sky-800",
    borderHover: "hover:border-sky-400",
  },
  "mie-makanan-berat": {
    iconBg: "bg-rose-100 text-rose-800",
    borderHover: "hover:border-rose-400",
  },
  "roti-bakar-camilan": {
    iconBg: "bg-orange-100 text-orange-800",
    borderHover: "hover:border-orange-400",
  },
};

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-black/10 bg-[#221611] text-white">
      {/* Latar foto sajian warkop dengan vignette hangat agar teks tetap kontras */}
      <Image
        src="/images/hero-warkop.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover object-center opacity-30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#1A100C]/95 via-[#251812]/88 to-[#2C1B14]/75"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-12 md:py-14">
        <div className="md:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#FFD7CD] backdrop-blur-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Self-Ordering Dine In &amp; Takeaway · Khas Aceh &amp; Medan
          </span>

          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ngopi &amp; Makan Nikmat di{" "}
            <span className="text-[#FF8577]">Warkop Agam</span>, Tanpa Antre.
          </h1>

          <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            Pesan Kopi Sanger, Teh Tarik Aceh, hingga Indomie Bangladesh langsung dari meja Anda
            melalui scan QR atau bungkus bawa pulang. Stok porsi dan status dapur terpantau secara{" "}
            <em>real-time</em>.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/menu"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-lg transition-all hover:bg-primary-hover active:scale-[0.99]"
            >
              <UtensilsCrossed className="h-4 w-4" aria-hidden />
              <span>Jelajahi Katalog Menu</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/lacak"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur-xs transition-all hover:bg-white hover:text-foreground"
            >
              <ReceiptText className="h-4 w-4 text-[#FF8577]" aria-hidden />
              <span>Lacak Pesanan</span>
            </Link>
            <Link
              href="/#info"
              className="inline-flex h-12 items-center gap-1.5 px-2 text-xs font-bold text-white/80 transition-colors hover:text-[#FF8577]"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              <span>Info Outlet</span>
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3 border-t border-white/15 pt-5 sm:max-w-lg">
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-xs">
              <div className="flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-[#FF8577]" aria-hidden />
                <p className="font-mono text-sm font-black text-white sm:text-base">QR Meja</p>
              </div>
              <p className="mt-0.5 text-[11px] text-white/70">Diantar ke meja</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-300" aria-hidden />
                <p className="font-mono text-sm font-black text-white sm:text-base">Real-Time</p>
              </div>
              <p className="mt-0.5 text-[11px] text-white/70">Stok &amp; status live</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-xs">
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-emerald-300" aria-hidden />
                <p className="font-mono text-sm font-black text-emerald-300 sm:text-base">QRIS</p>
              </div>
              <p className="mt-0.5 text-[11px] text-white/70">Tunai &amp; Non-Tunai</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-5">
          <HeroShowcase />
        </div>
      </div>
    </section>
  );
}

/** Bagian yang datanya diambil dari database MySQL (dengan fallback otomatis). */
async function CatalogSections() {
  const { categories, products, restaurant } = await getCatalog();
  const flaggedBest = products.filter((p) => p.bestSeller);
  const bestSellers = flaggedBest.length > 0 ? flaggedBest : products.slice(0, 4);

  return (
    <>
      {!restaurant.isWebOrderingOpen && (
        <div role="status" className="border-b border-error/20 bg-error/10 text-error">
          <p className="mx-auto max-w-6xl px-4 py-3 text-center text-xs font-bold">
            Pemesanan online sedang ditutup sementara karena antrean dapur penuh. Silakan pesan
            langsung di kasir.
          </p>
        </div>
      )}

      {/* Kategori unggulan */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              Eksplorasi Rasa
            </span>
            <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              Kategori Unggulan
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Pilih kategori hidangan favorit yang ingin Anda nikmati hari ini.
            </p>
          </div>
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-bold text-primary shadow-2xs transition-colors hover:border-primary hover:bg-primary hover:text-white"
          >
            Semua kategori <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {categories.map((c) => {
            const count = products.filter((p) => p.categoryId === c.id).length;
            const theme = CATEGORY_THEME_BY_SLUG[c.slug] ?? {
              iconBg: "bg-secondary-bg text-foreground",
              borderHover: "hover:border-primary",
            };
            return (
              <Link
                key={c.id}
                href={`/menu?kategori=${c.slug}`}
                className={`group flex flex-col justify-between rounded-2xl border border-border bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md ${theme.borderHover}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-transform group-hover:scale-110 ${theme.iconBg}`}
                      aria-hidden
                    >
                      {c.emoji}
                    </span>
                    <span className="rounded-full bg-secondary-bg px-2.5 py-0.5 font-mono text-[11px] font-bold text-foreground/80">
                      {count} menu
                    </span>
                  </div>
                  <h3 className="mt-3.5 text-sm font-extrabold text-foreground transition-colors group-hover:text-primary">
                    {c.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {c.description}
                  </p>
                </div>

                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary opacity-85 transition-opacity group-hover:opacity-100">
                  <span>Lihat Pilihan</span>
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Menu populer (Best Seller) */}
      <section className="border-y border-border bg-secondary-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <Flame className="h-3.5 w-3.5" aria-hidden />
                <span>Paling Diminati</span>
              </div>
              <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                Menu Populer (Best Seller)
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Hidangan terlaris pilihan pengunjung — klik menu untuk pilih varian dan tambah ke
                keranjang.
              </p>
            </div>
            <Link
              href="/menu"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 text-xs font-bold text-primary shadow-2xs transition-colors hover:bg-primary hover:text-white"
            >
              Lihat Katalog Lengkap <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {bestSellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Promo aktif */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Penawaran Spesial
          </span>
          <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            Promo &amp; Paket Hemat Aktif
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Salin kode promo atau manfaatkan paket hemat harian untuk Dine In dan Takeaway.
          </p>
        </div>
        <PromoCardList promos={promos} />
      </section>

      {/* Cara pesan & Lacak pesanan cepat di halaman utama */}
      <QuickTrackBanner />

      {/* Info restoran interaktif */}
      <RestaurantInfoSection restaurant={restaurant} />
    </>
  );
}

function SectionsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10" aria-hidden>
      <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary-bg" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-secondary-bg" />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <Suspense fallback={<SectionsSkeleton />}>
        <CatalogSections />
      </Suspense>
    </>
  );
}

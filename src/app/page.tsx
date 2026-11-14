import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Coffee,
  Flame,
  MapPin,
  MessageCircle,
  Sparkles,
  Tag,
  UtensilsCrossed,
} from "lucide-react";
import { OpenStatus } from "@/components/open-status";
import { ProductCard } from "@/components/product-card";
import { getCatalog } from "@/lib/catalog";
import { formatWhatsapp, promos } from "@/lib/menu-data";

function Hero() {
  return (
    <section className="border-b border-border bg-secondary-bg">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-12 md:py-16">
        <div className="md:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Self-Ordering Dine In &amp; Takeaway
          </span>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Ngopi &amp; Makan Nikmat di{" "}
            <span className="text-primary">Warkop Agam</span>, Tanpa Antre.
          </h1>
          <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Pesan Kopi Sanger, Teh Tarik Aceh, hingga Indomie Bangladesh langsung dari meja Anda
            melalui scan QR atau bungkus bawa pulang. Stok porsi dan status dapur terpantau secara{" "}
            <em>real-time</em>.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/menu"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-md transition-all hover:bg-primary-hover"
            >
              <UtensilsCrossed className="h-4 w-4" aria-hidden />
              <span>Jelajahi Katalog Menu</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3 border-t border-border pt-5 sm:max-w-lg">
            <div className="rounded-xl bg-white p-3 border border-border shadow-2xs">
              <p className="font-mono text-base font-black text-primary">QR Meja</p>
              <p className="text-[11px] text-muted-foreground">Langsung diantar ke meja</p>
            </div>
            <div className="rounded-xl bg-white p-3 border border-border shadow-2xs">
              <p className="font-mono text-base font-black text-foreground">Real-Time</p>
              <p className="text-[11px] text-muted-foreground">Stok &amp; status dapur</p>
            </div>
            <div className="rounded-xl bg-white p-3 border border-border shadow-2xs">
              <p className="font-mono text-base font-black text-emerald-700">QRIS / Tunai</p>
              <p className="text-[11px] text-muted-foreground">Bayar praktis &amp; cepat</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-5">
          <div className="relative mx-auto max-w-sm rounded-3xl border border-border bg-white p-5 shadow-md">
            <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#DC5B4E] p-6 text-center text-white">
              <span className="text-7xl drop-shadow" aria-hidden>
                ☕🍜
              </span>
              <p className="mt-3 text-lg font-extrabold tracking-tight">Khas Aceh &amp; Medan</p>
              <p className="mt-0.5 text-xs text-white/85">
                Racikan Kopi Saring, Teh Tarik, &amp; Mie Bangladesh
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <Link
                href="/menu"
                className="flex items-center gap-2 rounded-xl border border-border bg-secondary-bg p-2.5 font-semibold text-foreground transition-colors hover:border-primary"
              >
                <UtensilsCrossed className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="truncate">Semua Menu</span>
              </Link>
              <Link
                href="/menu?kategori=mie-makanan-berat"
                className="flex items-center gap-2 rounded-xl border border-border bg-secondary-bg p-2.5 font-semibold text-foreground transition-colors hover:border-primary"
              >
                <Coffee className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="truncate">Menu Favorit</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Bagian yang datanya diambil dari database MySQL (dengan fallback otomatis). */
async function CatalogSections() {
  const { categories, products, restaurant } = await getCatalog();
  const bestSellers = products.filter((p) => p.bestSeller);

  return (
    <>
      {!restaurant.isWebOrderingOpen && (
        <div role="status" className="bg-error/10 text-error">
          <p className="mx-auto max-w-6xl px-4 py-3 text-center text-xs font-bold">
            Pemesanan online sedang ditutup sementara karena antrean dapur penuh. Silakan pesan langsung di kasir.
          </p>
        </div>
      )}

      {/* Kategori unggulan */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              Kategori Unggulan
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Pilih kategori hidangan yang ingin Anda pesan hari ini.
            </p>
          </div>
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover"
          >
            Semua kategori <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {categories.map((c) => {
            const count = products.filter((p) => p.categoryId === c.id).length;
            return (
              <Link
                key={c.id}
                href={`/menu?kategori=${c.slug}`}
                className="group flex flex-col rounded-2xl border border-border bg-white p-4 shadow-2xs transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-bg text-2xl transition-transform group-hover:scale-110"
                    aria-hidden
                  >
                    {c.emoji}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                    {count} menu
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-bold text-foreground group-hover:text-primary">
                  {c.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
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
            </div>
            <Link
              href="/menu"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-primary border border-border shadow-2xs hover:bg-primary hover:text-white transition-colors"
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
        <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
          Promo &amp; Paket Hemat Aktif
        </h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Penawaran spesial harian untuk pelanggan Dine In maupun Takeaway.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {promos.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-2xs"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                <Tag className="h-5 w-5" aria-hidden />
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">{p.title}</h3>
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    {p.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
                {p.code && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Kode Info:{" "}
                    <span className="rounded-md border border-border bg-white px-2 py-0.5 font-mono text-xs font-bold text-primary">
                      {p.code}
                    </span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Info restoran */}
      <section id="info" className="scroll-mt-20 border-t border-border bg-secondary-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            Informasi Restoran
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Jam operasional, lokasi outlet, dan kontak resmi {restaurant.name}.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Clock className="h-5 w-5" aria-hidden />
                </span>
                <OpenStatus
                  openingHours={restaurant.openingHours}
                  forceClosed={!restaurant.isWebOrderingOpen}
                />
              </div>
              <h3 className="mt-4 text-sm font-bold text-foreground">Jam Operasional</h3>
              <p className="mt-1 text-xs text-muted-foreground">{restaurant.openingHours}</p>
            </div>

            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-sm font-bold text-foreground">Alamat</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {restaurant.address}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-sm font-bold text-foreground">Kontak WhatsApp Kasir</h3>
              <a
                href={`https://wa.me/${restaurant.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-mono text-xs font-bold text-primary hover:text-primary-hover"
              >
                {formatWhatsapp(restaurant.whatsapp)}
              </a>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Hubungi untuk konfirmasi pesanan atau reservasi meja.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10" aria-hidden>
      <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary-bg" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-secondary-bg" />
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

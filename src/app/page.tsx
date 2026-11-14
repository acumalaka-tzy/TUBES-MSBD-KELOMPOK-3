import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroShowcase } from "@/components/home/HeroShowcase";
import {
  QuickTrackBanner,
  RestaurantInfoSection,
} from "@/components/home/InteractiveSections";
import { ProductCard } from "@/components/product-card";
import { getCatalog } from "@/lib/catalog";

function Hero() {
  return (
    <section className="border-b border-border bg-secondary-bg text-foreground">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-12 md:py-14">
        <div className="md:col-span-7">
          <p className="text-xs font-semibold text-muted-foreground">
            Jalan Berdikari Baru 21, Padang Bulan · Buka 24 Jam
          </p>

          <h1 className="mt-2.5 text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.65rem]">
            Sajian <span className="text-primary">Warkop Agam</span>, Pesan Langsung dari Meja.
          </h1>

          <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Nikmati Kopi Sanger, TST, Teh Tarik, Soda Badak, Indomie Bangladesh, Mie Aceh, Roti
            Cane hingga Aneka Jus Segar 24 jam. Bisa pesan langsung di meja lewat scan QR atau
            bungkus bawa pulang.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <Link
              href="/menu"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              <span>Lihat Daftar Menu</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/lacak"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-5 text-sm font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <span>Cek Pesanan</span>
            </Link>
            <Link
              href="/#info"
              className="py-1 text-center text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-primary hover:underline sm:px-2 sm:py-0"
            >
              Lokasi &amp; Kontak
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-xs font-medium text-muted-foreground">
            <span>Pesan QR Meja &amp; Takeaway</span>
            <span aria-hidden className="text-border">•</span>
            <span>Bayar QRIS atau Tunai di Kasir</span>
            <span aria-hidden className="text-border">•</span>
            <span>Stok Porsi Terpantau Langsung</span>
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

      {/* Kategori menu */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              Kategori Menu
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Pilih kategori minuman atau makanan yang tersedia di Warkop Agam.
            </p>
          </div>
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover"
          >
            Semua menu <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-4 md:gap-4">
          {categories.map((c) => {
            const count = products.filter((p) => p.categoryId === c.id).length;
            return (
              <Link
                key={c.id}
                href={`/menu?kategori=${c.slug}`}
                className="group flex flex-col justify-between rounded-xl border border-border bg-white p-3.5 sm:p-4 transition-colors hover:border-primary/60"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xl" aria-hidden>
                      {c.emoji}
                    </span>
                    <span className="rounded-md bg-secondary-bg px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                      {count} menu
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                    {c.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {c.description}
                  </p>
                </div>

                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  <span>Lihat pilihan</span>
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Menu pilihan pengunjung (Best Seller) */}
      <section className="border-y border-border bg-secondary-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                Menu Pilihan Pengunjung
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Hidangan yang paling sering dipesan — klik menu untuk atur varian dan tambah ke
                keranjang.
              </p>
            </div>
            <Link
              href="/menu"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-xl border border-border bg-white px-3.5 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary sm:self-auto"
            >
              <span>Lihat Semua Menu</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {bestSellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Cara pesan & cek status pesanan */}
      <QuickTrackBanner />

      {/* Info restoran */}
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
          <div key={i} className="h-36 animate-pulse rounded-xl bg-secondary-bg" />
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

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  QuickTrackBanner,
  RestaurantInfoSection,
} from "@/components/home/InteractiveSections";
import { ProductCard } from "@/components/product-card";
import { OUTLET_PROFILE } from "@/lib/restaurant-profile";
import { getOutletSnapshot } from "@/lib/restaurant-snapshot";

/** Bagian Beranda yang memuat Hero Profil Restoran & Seluruh Seksi Terkait. */
async function HomeSections() {
  const { catalog, tableStats } = await getOutletSnapshot();
  const { categories, products, restaurant } = catalog;

  const flaggedBest = products.filter((p) => p.bestSeller);
  const bestSellers = flaggedBest.length > 0 ? flaggedBest : products.slice(0, 4);

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
      sub: `${tableStats.totalTables} meja • ${tableStats.totalSeats} kursi`,
    },
  ];

  return (
    <>
      {/* Hero & Profil Outlet Berdikari (Versi Bersih & Gambar Diperbesar) */}
      <section className="border-b border-border bg-secondary-bg text-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-8 sm:gap-10 sm:py-10 md:grid-cols-12 md:py-14">
          <div className="order-2 min-w-0 md:order-1 md:col-span-7">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.65rem]">
              {restaurant.name} Medan
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

            {/* Metrik 3 Kolom Ringkas */}
            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3.5">
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className="min-w-0 rounded-xl border border-border bg-white px-3.5 py-3 shadow-2xs"
                >
                  <p className="text-[11px] font-semibold text-muted-foreground">{m.label}</p>
                  <p className="mt-0.5 text-base font-extrabold text-foreground sm:text-lg">
                    {m.value}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{m.sub}</p>
                </div>
              ))}
            </div>

            {/* Tombol Aksi */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/menu"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-hover shadow-2xs"
              >
                <span>Jelajahi Menu</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/checkout"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-5 text-sm font-bold text-foreground transition-colors hover:border-primary hover:text-primary shadow-2xs"
              >
                <span>Pesan Sekarang</span>
              </Link>
            </div>
          </div>

          {/* Foto Resmi Outlet Warkop Agam Berdikari (Diperbesar) */}
          <div className="order-1 md:order-2 md:col-span-5">
            <figure className="mx-auto w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[440px] overflow-hidden rounded-2xl border border-border bg-white shadow-md transition-all hover:shadow-lg">
              <div className="relative aspect-[4/3] sm:aspect-[4/3.5] lg:aspect-[4/3.2] w-full bg-secondary-bg">
                <Image
                  src={OUTLET_PROFILE.storefrontImage}
                  alt={OUTLET_PROFILE.storefrontAlt}
                  fill
                  priority
                  sizes="(max-width: 768px) 95vw, 450px"
                  className="object-cover"
                />
              </div>
              <figcaption className="border-t border-border p-3.5 sm:p-4">
                <p className="text-xs sm:text-sm font-extrabold text-foreground">
                  {OUTLET_PROFILE.brandTitle}
                </p>
                <p className="mt-0.5 text-[11px] sm:text-xs leading-relaxed text-muted-foreground">
                  {restaurant.address}
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {!restaurant.isWebOrderingOpen && (
        <div role="status" className="border-b border-error/20 bg-error/10 text-error">
          <p className="mx-auto max-w-6xl px-4 py-3 text-center text-xs font-bold">
            Pemesanan online sedang ditutup sementara karena antrean dapur penuh. Silakan pesan
            langsung di kasir.
          </p>
        </div>
      )}

      {/* Kategori Menu (Dimulai langsung di bawah Hero Beranda) */}
      <section id="kategori" className="scroll-mt-20 mx-auto w-full max-w-6xl px-4 py-10">
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

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {bestSellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Cara pesan & cek status pesanan */}
      <QuickTrackBanner />

      {/* Info restoran & Peta Google Maps */}
      <RestaurantInfoSection restaurant={restaurant} />
    </>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10" aria-hidden>
      <div className="h-48 sm:h-64 animate-pulse rounded-2xl bg-secondary-bg" />
      <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary-bg" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 sm:h-36 animate-pulse rounded-xl bg-secondary-bg" />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeSections />
    </Suspense>
  );
}

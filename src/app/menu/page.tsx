import { Suspense } from "react";
import type { Metadata } from "next";
import { Database } from "lucide-react";
import { MenuCatalog } from "@/components/menu-catalog";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Katalog Menu — Warkop Agam",
  description: "Katalog menu makanan dan minuman Warkop Agam.",
};

async function CatalogLoader() {
  const { categories, products, source } = await getCatalog();
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary-bg px-3.5 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium">
          <Database className="h-3.5 w-3.5 text-primary" aria-hidden />
          {source === "database"
            ? "Terhubung langsung dengan database MySQL Warkop Agam (real-time stock)."
            : "Mode Pratinjau Mandiri — menampilkan katalog Warkop Agam (otomatis beralih ke MySQL saat DATABASE_URL aktif)."}
        </span>
        <span className="font-mono text-[11px] font-bold text-primary">
          {products.length} Menu • {categories.length} Kategori
        </span>
      </div>

      <Suspense fallback={<CatalogSkeleton />}>
        <MenuCatalog categories={categories} products={products} />
      </Suspense>
    </>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-2xl bg-secondary-bg" />
      ))}
    </div>
  );
}

export default function MenuPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
          Katalog Menu
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pilih hidangan favorit Anda, sesuaikan varian/topping, lalu lanjutkan ke Checkout.
        </p>
      </header>
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogLoader />
      </Suspense>
    </div>
  );
}

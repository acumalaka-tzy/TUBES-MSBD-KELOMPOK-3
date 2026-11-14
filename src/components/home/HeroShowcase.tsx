"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flame, Plus, Sparkles, UtensilsCrossed } from "lucide-react";
import { ProductDetail } from "@/components/product-detail";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { useCart } from "@/context/cart-context";
import { useActiveTable } from "@/lib/active-table";
import { getStockStatus, sampleProducts, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

const FEATURED_IDS = [
  "prd-sanger-01",
  "prd-bangladesh-06",
  "prd-tehtarik-02",
  "prd-rotibakar-08",
];

function pickShowcaseProducts(): Product[] {
  const byId = new Map(sampleProducts.map((p) => [p.id, p]));
  const picked = FEATURED_IDS.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  return picked.length > 0 ? picked : sampleProducts.slice(0, 4);
}

const SHOWCASE_ITEMS = pickShowcaseProducts();

export function HeroShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const activeTable = useActiveTable();
  const { openCart } = useCart();

  const item = SHOWCASE_ITEMS[activeIndex] ?? SHOWCASE_ITEMS[0];
  if (!item) return null;

  const status = getStockStatus(item.availableQty, item.minThreshold);
  const soldOut = status === "OUT_OF_STOCK";

  function handlePrev() {
    setActiveIndex((prev) => (prev - 1 + SHOWCASE_ITEMS.length) % SHOWCASE_ITEMS.length);
  }

  function handleNext() {
    setActiveIndex((prev) => (prev + 1) % SHOWCASE_ITEMS.length);
  }

  return (
    <>
      <div className="relative mx-auto w-full max-w-md">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-4 -z-10 rounded-[2.25rem] bg-gradient-to-tr from-primary/35 via-warning/25 to-transparent blur-2xl"
        />

        <div className="rounded-3xl border border-white/15 bg-white p-4 text-foreground shadow-2xl sm:p-5">
          {/* Bar atas kartu showcase */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                <Sparkles className="h-3 w-3" aria-hidden />
                {activeTable ? `Meja ${activeTable} Aktif` : "Menu Andalan"}
              </span>
              <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                {activeIndex + 1}/{SHOWCASE_ITEMS.length}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Lihat menu andalan sebelumnya"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary-bg text-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Lihat menu andalan berikutnya"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary-bg text-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Foto hidangan + overlay harga */}
          <div
            onClick={() => {
              if (!soldOut) setDetailOpen(true);
            }}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-[#2A1C16]"
          >
            <ProductImage
              product={item}
              priority
              className="aspect-[16/10] w-full transition-transform duration-300 group-hover:scale-[1.04]"
              emojiClassName="text-5xl"
              sizes="(max-width: 768px) 100vw, 420px"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
            />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
              <Flame className="h-3 w-3" aria-hidden /> Favorit Konsumen
            </span>
            <span className="absolute bottom-3 left-3 text-[11px] font-semibold text-white/95 drop-shadow-xs">
              Klik untuk pilih varian
            </span>
            <span className="absolute bottom-2.5 right-3 rounded-xl bg-white/95 px-2.5 py-1 font-mono text-xs font-extrabold text-foreground shadow-sm">
              {formatRupiah(item.basePrice)}
            </span>
          </div>

          {/* Detail & tombol aksi langsung */}
          <div className="mt-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {item.categoryName}
              </span>
              <StockBadge status={status} />
            </div>
            <h2 className="mt-0.5 text-base font-extrabold tracking-tight text-foreground">
              {item.name}
            </h2>
            <p className="mt-1 line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-muted-foreground">
              {item.description}
            </p>

            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                disabled={soldOut}
                onClick={() => setDetailOpen(true)}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-xs transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                <span>Pesan Cepat</span>
              </button>
              <Link
                href="/menu"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary-bg px-3.5 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <UtensilsCrossed className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span>Katalog</span>
              </Link>
            </div>
          </div>

          {/* Selector thumbnail mini interaktif */}
          <div className="mt-4 grid grid-cols-4 gap-1.5 border-t border-border/70 pt-3">
            {SHOWCASE_ITEMS.map((entry, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl p-1.5 text-center transition-all cursor-pointer",
                    active
                      ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                      : "bg-secondary-bg/70 text-muted-foreground hover:bg-secondary-bg hover:text-foreground",
                  )}
                >
                  <ProductImage
                    product={entry}
                    className="h-7 w-full rounded-lg"
                    emojiClassName="text-sm"
                    sizes="80px"
                  />
                  <span className="w-full truncate text-[10px] font-bold">
                    {entry.name.split(" ").slice(0, 2).join(" ")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {detailOpen && (
        <ProductDetail
          product={item}
          onClose={() => setDetailOpen(false)}
          onAdded={() => {
            setDetailOpen(false);
            openCart();
          }}
        />
      )}
    </>
  );
}

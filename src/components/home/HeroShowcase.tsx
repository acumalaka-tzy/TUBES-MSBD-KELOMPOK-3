"use client";

import { useState } from "react";
import { ProductDetail } from "@/components/product-detail";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { useCart } from "@/context/cart-context";
import { useActiveTable } from "@/lib/active-table";
import { getStockStatus, sampleProducts, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

const FEATURED_TABS: Array<{ id: string; label: string }> = [
  { id: "prd-sanger-01", label: "Kopi Sanger" },
  { id: "prd-bangladesh-06", label: "Indomie" },
  { id: "prd-tehtarik-02", label: "Teh Tarik" },
  { id: "prd-rotibakar-08", label: "Roti Bakar" },
];

function pickShowcaseProducts(): Product[] {
  const byId = new Map(sampleProducts.map((p) => [p.id, p]));
  const picked = FEATURED_TABS.map((t) => byId.get(t.id)).filter((p): p is Product => Boolean(p));
  return picked.length > 0 ? picked : sampleProducts.slice(0, 4);
}

const TAB_LABELS = new Map(FEATURED_TABS.map((t) => [t.id, t.label]));
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

  return (
    <>
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <button
          type="button"
          onClick={() => {
            if (!soldOut) setDetailOpen(true);
          }}
          className="block w-full overflow-hidden border-b border-border bg-secondary-bg text-left cursor-pointer"
        >
          <ProductImage
            product={item}
            priority
            className="aspect-[16/10] w-full transition-transform duration-300 hover:scale-[1.02]"
            emojiClassName="text-5xl"
            sizes="(max-width: 768px) 100vw, 420px"
          />
        </button>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">
              {activeTable ? `Meja ${activeTable} • ${item.categoryName}` : item.categoryName}
            </span>
            <StockBadge status={status} />
          </div>

          <div className="mt-1.5 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-bold tracking-tight text-foreground">{item.name}</h2>
            <span className="shrink-0 font-mono text-sm font-bold text-primary">
              {formatRupiah(item.basePrice)}
            </span>
          </div>

          <p className="mt-1 line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </p>

          <button
            type="button"
            disabled={soldOut}
            onClick={() => setDetailOpen(true)}
            className="mt-3.5 flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-xs font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
          >
            Pesan {item.name}
          </button>

          <div className="mt-3.5 grid grid-cols-2 gap-1.5 border-t border-border pt-3 sm:grid-cols-4">
            {SHOWCASE_ITEMS.map((entry, idx) => {
              const active = idx === activeIndex;
              const shortLabel = TAB_LABELS.get(entry.id) ?? entry.name.split(" ")[0];
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    "truncate rounded-md border px-2 py-1.5 text-center text-[11px] font-semibold transition-colors cursor-pointer",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-secondary-bg text-muted-foreground hover:text-foreground",
                  )}
                >
                  {shortLabel}
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

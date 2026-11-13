"use client";

import { useEffect, useState } from "react";
import { Check, Flame, Plus } from "lucide-react";
import { ProductDetail } from "@/components/product-detail";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { getStockStatus, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const status = getStockStatus(product.availableQty, product.minThreshold);
  const soldOut = status === "OUT_OF_STOCK";

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <>
      <article
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xs transition-all",
          !soldOut && "hover:border-primary/50 hover:shadow-md",
        )}
      >
        <div className="relative">
          <ProductImage product={product} className={cn("aspect-[4/3]", soldOut && "grayscale")} />
          {product.bestSeller && !soldOut && (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
              <Flame className="h-3 w-3" aria-hidden /> Best Seller
            </span>
          )}
        </div>

        <div className={cn("flex flex-1 flex-col gap-1.5 p-3.5 sm:p-4", soldOut && "opacity-60")}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-semibold text-muted-foreground">
              {product.categoryName}
            </span>
            <StockBadge status={status} />
          </div>
          <h3 className="line-clamp-1 text-sm font-bold text-foreground">{product.name}</h3>
          <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-muted-foreground">
            {product.description}
          </p>
          <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2.5">
            <div>
              <span className="font-mono text-sm font-extrabold text-foreground">
                {formatRupiah(product.basePrice)}
              </span>
              {!soldOut && (
                <span className="block font-mono text-[10px] text-muted-foreground">
                  Sisa: {product.availableQty} porsi
                </span>
              )}
            </div>
            {soldOut ? (
              <span className="rounded-lg bg-error/10 px-2.5 py-1 text-xs font-bold text-error">
                Habis
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`Pilih ${product.name}`}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-white shadow-2xs transition-colors after:absolute after:inset-0 hover:bg-primary-hover"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                <span>Tambah</span>
              </button>
            )}
          </div>
        </div>
      </article>

      {open && <ProductDetail product={product} onClose={() => setOpen(false)} onAdded={setNotice} />}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 md:bottom-6">
        {notice && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-foreground px-4 py-3 text-xs font-bold text-white shadow-lg">
            <Check className="h-4 w-4 text-emerald-400" aria-hidden />
            {notice}
          </div>
        )}
      </div>
    </>
  );
}

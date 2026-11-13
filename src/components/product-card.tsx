"use client";

import { useEffect, useState } from "react";
import { Check, Eye, Flame, Plus, ShoppingBag } from "lucide-react";
import { ProductDetail } from "@/components/product-detail";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { useCart } from "@/context/cart-context";
import { getStockStatus, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { getProductCartQuantity, openCart } = useCart();

  const status = getStockStatus(product.availableQty, product.minThreshold);
  const soldOut = status === "OUT_OF_STOCK";
  const inCartQty = getProductCartQuantity(product.id);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <>
      <article
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-2xs transition-all",
          inCartQty > 0 ? "border-primary/40 ring-1 ring-primary/15" : "border-border",
          !soldOut && "hover:border-primary/50 hover:shadow-md",
        )}
      >
        <div className="relative">
          <ProductImage
            product={product}
            className={cn(
              "aspect-[4/3] transition-transform duration-300",
              !soldOut && "group-hover:scale-[1.02]",
              soldOut && "grayscale",
            )}
          />
          {product.bestSeller && !soldOut && (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
              <Flame className="h-3 w-3" aria-hidden /> Best Seller
            </span>
          )}
          {inCartQty > 0 && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-foreground/90 px-2.5 py-1 font-mono text-[11px] font-bold text-white shadow-sm backdrop-blur">
              <ShoppingBag className="h-3 w-3 text-primary" aria-hidden />
              {inCartQty}×
            </span>
          )}
          {product.options.length > 0 && !soldOut && (
            <span className="absolute bottom-2 left-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-foreground/80 shadow-2xs backdrop-blur">
              {product.options.length} grup varian
            </span>
          )}
        </div>

        <div className={cn("flex flex-1 flex-col gap-1.5 p-3.5 sm:p-4", soldOut && "opacity-75")}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-semibold text-muted-foreground">
              {product.categoryName}
            </span>
            <StockBadge status={status} />
          </div>
          <h3 className="line-clamp-1 text-sm font-bold text-foreground group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-muted-foreground">
            {product.description}
          </p>
          <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2.5">
            <div>
              <span className="font-mono text-sm font-extrabold text-foreground">
                {formatRupiah(product.basePrice)}
              </span>
              {!soldOut ? (
                <span className="block font-mono text-[10px] text-muted-foreground">
                  Sisa: {product.availableQty} porsi
                </span>
              ) : (
                <span className="block font-mono text-[10px] text-error font-semibold">
                  Stok: 0 porsi
                </span>
              )}
            </div>
            {soldOut ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`Lihat detail ${product.name} (Habis)`}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-secondary-bg px-2.5 text-xs font-bold text-muted-foreground transition-colors after:absolute after:inset-0 hover:bg-border/60 hover:text-foreground"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                <span>Habis</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`Pilih ${product.name}`}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-white shadow-2xs transition-colors after:absolute after:inset-0 hover:bg-primary-hover"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                <span>{inCartQty > 0 ? "Tambah Lagi" : "Tambah"}</span>
              </button>
            )}
          </div>
        </div>
      </article>

      {open && (
        <ProductDetail
          product={product}
          onClose={() => setOpen(false)}
          onAdded={setNotice}
        />
      )}

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 md:bottom-6"
      >
        {notice && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-foreground px-4 py-3 text-xs font-bold text-white shadow-xl">
            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                openCart();
              }}
              className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-primary-hover"
            >
              Lihat Keranjang
            </button>
          </div>
        )}
      </div>
    </>
  );
}


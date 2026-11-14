"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { ProductDetail } from "@/components/product-detail";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { useCart } from "@/context/cart-context";
import { getStockStatus, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { items, openCart } = useCart();

  const cartItemsForProduct = items.filter((it) => it.productId === product.id);
  const totalQtyInCart = cartItemsForProduct.reduce((sum, it) => sum + it.quantity, 0);

  const status = getStockStatus(product.availableQty, product.minThreshold);
  const soldOut = status === "OUT_OF_STOCK";

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <>
      <article
        onClick={() => {
          if (!soldOut) setOpen(true);
        }}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-white transition-all cursor-pointer",
          !soldOut && "hover:border-primary/60 hover:shadow-sm",
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
            <span className="absolute left-2.5 top-2.5 rounded-md bg-foreground/85 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background">
              Favorit
            </span>
          )}

          {/* Indikator Badge Jumlah di Keranjang */}
          {totalQtyInCart > 0 && (
            <span
              title={`${totalQtyInCart} item ada di keranjang`}
              className="absolute right-2.5 top-2.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-bold text-white shadow-sm ring-2 ring-white"
            >
              {totalQtyInCart}
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
              <span className="rounded-lg bg-error/10 px-2.5 py-1 text-xs font-bold text-error">
                Habis
              </span>
            ) : totalQtyInCart > 0 ? (
              /* Tombol dengan indikator jumlah (Sudah ada di keranjang - Hanya angka saja) */
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
                aria-label={`${totalQtyInCart} ${product.name} di keranjang`}
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-primary px-3 text-xs font-black text-white shadow-2xs transition-colors hover:bg-primary-hover"
              >
                <span>{totalQtyInCart}</span>
              </button>
            ) : (
              /* Tombol Tambah default */
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
                aria-label={`Pilih ${product.name}`}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-primary-hover"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                <span>Tambah</span>
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


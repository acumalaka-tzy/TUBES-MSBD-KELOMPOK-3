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
          "group relative flex flex-row items-center gap-3.5 p-3 sm:flex-col sm:items-stretch sm:p-0 overflow-hidden rounded-2xl border border-border bg-white transition-all cursor-pointer shadow-2xs",
          !soldOut && "hover:border-primary/60 hover:shadow-sm",
        )}
      >
        {/* Kontainer Gambar Produk */}
        <div className="relative shrink-0 overflow-hidden rounded-xl sm:rounded-none">
          <ProductImage
            product={product}
            className={cn(
              "aspect-square w-24 min-[400px]:w-28 sm:w-full sm:h-auto sm:aspect-[4/3] transition-transform duration-300",
              !soldOut && "group-hover:scale-[1.03]",
              soldOut && "grayscale",
            )}
          />
          {product.bestSeller && !soldOut && (
            <span className="absolute left-1.5 top-1.5 sm:left-2.5 sm:top-2.5 rounded-md bg-foreground/85 px-1.5 py-0.5 sm:px-2 text-[9px] sm:text-[10px] font-semibold tracking-wide text-background shadow-xs">
              Favorit
            </span>
          )}

          {/* Indikator Badge Jumlah di Keranjang (Tampil di pojok foto pada Desktop) */}
          {totalQtyInCart > 0 && (
            <span
              title={`${totalQtyInCart} item ada di keranjang`}
              className="hidden sm:inline-flex absolute right-2.5 top-2.5 h-6 min-w-6 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-bold text-white shadow-sm ring-2 ring-white"
            >
              {totalQtyInCart}
            </span>
          )}
        </div>

        {/* Kontainer Deskripsi & Tombol Aksi (Tanpa label kategori di dalam card) */}
        <div className={cn("flex flex-1 min-w-0 flex-col gap-1 sm:gap-1.5 sm:p-4", soldOut && "opacity-75")}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 sm:line-clamp-2 text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
              {product.name}
            </h3>
            {status !== "AVAILABLE" && (
              <div className="shrink-0">
                <StockBadge status={status} />
              </div>
            )}
          </div>

          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:min-h-[2.25rem]">
            {product.description}
          </p>

          <div className="mt-1 sm:mt-auto flex items-center justify-between gap-2 pt-1 sm:border-t sm:border-border/60 sm:pt-2.5">
            <div>
              <span className="block font-mono text-sm sm:text-base font-black text-primary">
                {formatRupiah(product.basePrice)}
              </span>
              {!soldOut ? (
                <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                  Sisa: {product.availableQty} porsi
                </span>
              ) : (
                <span className="mt-0.5 block font-mono text-[10px] text-error font-semibold">
                  Stok: 0 porsi
                </span>
              )}
            </div>

            {soldOut ? (
              <span className="shrink-0 rounded-lg bg-error/10 px-2.5 py-1 text-center text-xs font-bold text-error">
                Habis
              </span>
            ) : totalQtyInCart > 0 ? (
              /* Tombol dengan indikator jumlah di keranjang */
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
                aria-label={`${totalQtyInCart} ${product.name} di keranjang`}
                className="inline-flex h-8 sm:h-9 min-w-8 items-center justify-center gap-1 rounded-full sm:rounded-xl bg-primary px-2.5 sm:px-3 text-xs font-black text-white shadow-2xs transition-colors hover:bg-primary-hover"
              >
                <span>{totalQtyInCart}</span>
                <span className="hidden sm:inline"> di Keranjang</span>
              </button>
            ) : (
              /* Tombol Tambah bulat ala GrabFood di mobile, pill di desktop */
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
                aria-label={`Pilih ${product.name}`}
                className="inline-flex size-8 sm:size-auto sm:h-9 items-center justify-center rounded-full sm:rounded-xl bg-primary text-white sm:px-3 text-xs font-bold shadow-2xs transition-colors hover:bg-primary-hover"
              >
                <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
                <span className="hidden sm:inline sm:ml-1">Tambah</span>
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
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2.5 rounded-2xl bg-foreground px-3.5 py-2.5 text-xs font-bold text-white shadow-xl sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="min-w-0 break-words">{notice}</span>
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                openCart();
              }}
              className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-primary-hover"
            >
              Lihat Keranjang
            </button>
          </div>
        )}
      </div>
    </>
  );
}


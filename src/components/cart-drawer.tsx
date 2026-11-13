"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag, Sparkles, Trash2, X } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useActiveTable } from "@/lib/active-table";
import { formatRupiah } from "@/lib/utils";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    loadSampleItems,
    subtotal,
    taxAmount,
    totalAmount,
    itemCount,
  } = useCart();
  const table = useActiveTable();
  const checkoutHref = table ? `/checkout?table=${encodeURIComponent(table)}` : "/checkout";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Tutup keranjang"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="cart-drawer-title" className="text-base font-bold leading-tight text-foreground">
                Keranjang Pesanan
              </h2>
              <p className="text-xs text-muted-foreground">
                {itemCount} porsi dipilih{table ? ` • Meja ${table}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-error hover:bg-error/10"
              >
                Kosongkan
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="flex size-9 items-center justify-center rounded-xl border border-border hover:bg-secondary-bg"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary-bg text-muted-foreground">
                <ShoppingBag className="size-6" aria-hidden />
              </div>
              <p className="mt-3 text-sm font-bold text-foreground">Keranjang masih kosong</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Pilih menu favoritmu di Katalog Menu atau muat contoh pesanan untuk langsung mencoba Checkout.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link
                  href="/menu"
                  onClick={onClose}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-white hover:bg-primary-hover"
                >
                  Lihat Katalog Menu
                </Link>
                <button
                  type="button"
                  onClick={loadSampleItems}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-secondary-bg px-3.5 text-xs font-semibold text-foreground hover:bg-border/60"
                >
                  <Sparkles className="size-3.5 text-primary" aria-hidden />
                  Muat Contoh Pesanan
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{item.name}</p>
                    {item.options && item.options.length > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.options.map((o) => o.optionName).join(", ")}
                      </p>
                    )}
                    {item.itemNotes && (
                      <p className="mt-0.5 text-xs italic text-primary">&ldquo;{item.itemNotes}&rdquo;</p>
                    )}
                    <p className="mt-1 font-mono text-xs font-bold text-foreground">
                      {formatRupiah(item.subtotal)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <div className="flex items-center rounded-xl border border-border bg-secondary-bg">
                      <button
                        type="button"
                        aria-label={`Kurangi ${item.name}`}
                        onClick={() => updateQuantity(item.id, -1)}
                        className="flex size-8 items-center justify-center hover:text-primary"
                      >
                        <Minus className="size-3.5" aria-hidden />
                      </button>
                      <span className="w-6 text-center font-mono text-xs font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Tambah ${item.name}`}
                        onClick={() => updateQuantity(item.id, 1)}
                        className="flex size-8 items-center justify-center hover:text-primary"
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`Hapus ${item.name}`}
                      onClick={() => removeItem(item.id)}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-error/10 hover:text-error"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border bg-secondary-bg/60 p-5">
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Subtotal Item</span>
                <span className="font-mono font-medium text-foreground">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pajak Restoran (PB1 10%)</span>
                <span className="font-mono font-medium text-foreground">{formatRupiah(taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-sm font-extrabold text-foreground">
                <span>Total Tagihan</span>
                <span className="font-mono text-base text-primary">{formatRupiah(totalAmount)}</span>
              </div>
            </div>

            <Link
              href={checkoutHref}
              onClick={onClose}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-hover"
            >
              <span>Lanjut ke Checkout</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

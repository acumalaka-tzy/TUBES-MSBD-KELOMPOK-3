"use client";

import React from "react";
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight } from "lucide-react";
import { CartItem } from "@/context/cart-context";

interface CartSummaryProps {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  isSubmitting: boolean;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onEditItem: (item: CartItem) => void;
}

export function CartSummary({
  items,
  itemCount,
  subtotal,
  taxAmount,
  totalAmount,
  isSubmitting,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onEditItem,
}: CartSummaryProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xs sticky top-24">
      <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">Ringkasan Pesanan</h2>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearCart}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Kosongkan
          </button>
        )}
      </div>

      {/* Daftar Item Pesanan */}
      <div className="space-y-3 max-h-80 overflow-y-auto divide-y divide-border/60 pr-1">
        {items.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Keranjang pesanan masih kosong.
            </p>
            <a
              href="/menu"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              Pilih dari Katalog Menu &rarr;
            </a>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="py-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-foreground leading-snug">
                    {item.name}
                  </p>
                  {/* Tombol Edit: teks tanpa background */}
                  <button
                    type="button"
                    onClick={() => onEditItem(item)}
                    className="text-xs font-bold text-primary hover:underline hover:text-primary-hover transition-colors shrink-0 bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                {item.options && item.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.options.map((opt, i) => (
                      <span
                        key={i}
                        className="inline-block text-[10px] bg-secondary-bg text-muted-foreground px-1.5 py-0.5 rounded font-medium"
                      >
                        {opt.groupName}: {opt.optionName}
                        {opt.priceAdjustment > 0 &&
                          ` (+Rp ${opt.priceAdjustment.toLocaleString("id-ID")})`}
                      </span>
                    ))}
                  </div>
                )}

                {item.itemNotes && (
                  <p className="text-[11px] text-muted-foreground italic mt-0.5 line-clamp-1">
                    &ldquo;{item.itemNotes}&rdquo;
                  </p>
                )}

                <p className="text-xs font-bold text-primary mt-1 font-mono">
                  Rp {(item.unitPrice * item.quantity).toLocaleString("id-ID")}
                </p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center border border-border rounded-lg bg-secondary-bg">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                    className="p-1 hover:bg-border/60 rounded-l-lg transition-colors text-muted-foreground hover:text-foreground"
                    title="Kurangi"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center text-xs font-bold font-mono">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                    className="p-1 hover:bg-border/60 rounded-r-lg transition-colors text-muted-foreground hover:text-foreground"
                    title="Tambah"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rincian Kalkulasi Harga */}
      {items.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border text-sm">
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>Subtotal ({itemCount} item)</span>
            <span className="font-mono text-foreground font-semibold">
              Rp {subtotal.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="flex justify-between text-muted-foreground text-xs">
            <span className="flex items-center gap-1">
              Pajak Restoran (PB1 10%)
            </span>
            <span className="font-mono text-foreground font-semibold">
              Rp {taxAmount.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="flex justify-between items-baseline pt-2 border-t border-border font-bold">
            <span className="text-foreground">Total Pembayaran</span>
            <span className="text-lg font-black text-primary font-mono">
              Rp {totalAmount.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      )}

      {/* Tombol Buat Pesanan */}
      <div className="mt-5">
        <button
          type="submit"
          disabled={isSubmitting || items.length === 0}
          className="w-full py-3.5 px-4 bg-primary hover:bg-primary-hover disabled:bg-muted-foreground/30 text-white font-bold rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Menyimpan ke MySQL...</span>
            </>
          ) : (
            <>
              <span>Konfirmasi & Simpan Pesanan</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-muted-foreground mt-2">
          Data pesanan akan disimpan langsung ke tabel <strong>orders</strong> MySQL Anda.
        </p>
      </div>
    </div>
  );
}


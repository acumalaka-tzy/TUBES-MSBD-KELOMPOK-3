"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { getStockStatus, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

/**
 * Detail produk & Alur GrabFood (PRD 5.3):
 * 1. Mode "manage": Menampilkan varian yang sudah ada di keranjang + tombol "Make another".
 * 2. Mode "customize": Form pemilihan opsi/varian baru.
 */
export function ProductDetail({
  product,
  onClose,
  onAdded,
}: {
  product: Product;
  onClose: () => void;
  onAdded?: (message: string) => void;
}) {
  const { items, addItem, updateQuantity } = useCart();
  const existingItems = items.filter((it) => it.productId === product.id);

  // Jika produk sudah ada di keranjang, buka tampilan riwayat & "Make another" (seperti GrabFood)
  const [viewMode, setViewMode] = useState<"manage" | "customize">(
    existingItems.length > 0 ? "manage" : "customize",
  );

  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      product.options.map((g) => [g.id, g.type === "single" && g.required ? [g.items[0].id] : []]),
    ),
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Jika semua item dari produk ini dihapus saat di mode manage, alihkan ke mode customize
  useEffect(() => {
    if (viewMode === "manage" && existingItems.length === 0) {
      setViewMode("customize");
    }
  }, [existingItems.length, viewMode]);

  const status = getStockStatus(product.availableQty, product.minThreshold);

  const chosen = useMemo(
    () =>
      product.options.flatMap((g) =>
        g.items.filter((i) => selected[g.id]?.includes(i.id)).map((i) => ({ group: g.name, ...i })),
      ),
    [product.options, selected],
  );
  const optionsTotal = chosen.reduce((s, i) => s + i.price, 0);
  const unitPrice = product.basePrice + optionsTotal;
  const missingRequired = product.options.some((g) => g.required && !selected[g.id]?.length);

  function toggle(groupId: string, itemId: string, type: "single" | "multi") {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (type === "single") return { ...prev, [groupId]: [itemId] };
      return {
        ...prev,
        [groupId]: current.includes(itemId) ? current.filter((i) => i !== itemId) : [...current, itemId],
      };
    });
  }

  function handleResetCustomization() {
    setSelected(
      Object.fromEntries(
        product.options.map((g) => [g.id, g.type === "single" && g.required ? [g.items[0].id] : []]),
      ),
    );
    setQuantity(1);
    setNote("");
  }

  function submitNew() {
    addItem({
      productId: product.id,
      name: product.name,
      unitPrice: product.basePrice,
      quantity,
      options: chosen.map((i) => ({ groupName: i.group, optionName: i.name, priceAdjustment: i.price })),
      itemNotes: note.trim() || undefined,
    });
    onAdded?.(`${quantity}× ${product.name} varian baru ditambahkan ke keranjang`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <button type="button" aria-label="Tutup" onClick={onClose} className="absolute inset-0 bg-black/50" />
      
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:max-h-[88dvh] md:max-w-lg md:rounded-3xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden />
        
        {/* Tombol Tutup */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail"
          className="absolute right-3.5 top-3.5 z-20 flex size-9 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
        >
          <X className="size-4" aria-hidden />
        </button>

        {/* =========================================================================
            TAMPILAN 1: MANAGE / MAKE ANOTHER (GAYA GRABFOOD)
           ========================================================================= */}
        {viewMode === "manage" ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header Produk Ringkas */}
            <div className="p-5 pb-3 border-b border-border pr-12">
              <div className="flex items-center justify-between gap-2">
                <h2 id="product-detail-title" className="text-xl font-black text-foreground">
                  {product.name}
                </h2>
                <div className="text-right shrink-0">
                  <span className="block font-mono text-base font-black text-foreground">
                    {formatRupiah(product.basePrice)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Harga dasar</span>
                </div>
              </div>
            </div>

            {/* List Item yang Sudah Berada di Keranjang */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                <span>Pilihan yang Sedang di Keranjang ({existingItems.length})</span>
              </p>

              <div className="space-y-3">
                {existingItems.map((cartItem) => (
                  <div
                    key={cartItem.id}
                    className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-border bg-secondary-bg/50 hover:bg-white transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="size-14 rounded-xl overflow-hidden shrink-0 border border-border bg-white flex items-center justify-center">
                        <ProductImage product={product} className="size-full" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-foreground truncate">
                          {cartItem.name}
                        </p>
                        {cartItem.options && cartItem.options.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {cartItem.options.map((o) => `${o.optionName}`).join(", ")}
                          </p>
                        )}
                        {cartItem.itemNotes && (
                          <p className="text-[11px] text-primary/80 italic mt-0.5">
                            &ldquo;{cartItem.itemNotes}&rdquo;
                          </p>
                        )}
                        <p className="font-mono text-xs font-black text-foreground mt-1.5">
                          {formatRupiah(cartItem.subtotal)}
                        </p>
                      </div>
                    </div>

                    {/* Quantity Control Pill (Gaya GrabFood) */}
                    <div className="flex items-center border border-border rounded-full bg-white p-0.5 shadow-2xs shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(cartItem.id, -1)}
                        className="size-7 rounded-full flex items-center justify-center hover:bg-secondary-bg text-muted-foreground hover:text-foreground transition-colors"
                        title="Kurangi"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono font-bold text-xs text-foreground">
                        {cartItem.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(cartItem.id, 1)}
                        className="size-7 rounded-full flex items-center justify-center hover:bg-secondary-bg text-primary transition-colors"
                        title="Tambah"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tombol Utama: MAKE ANOTHER (Gaya GrabFood) */}
            <div className="border-t border-border bg-white p-4">
              <button
                type="button"
                onClick={() => {
                  handleResetCustomization();
                  setViewMode("customize");
                }}
                className="h-12 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Plus className="size-4" />
                <span>Make another (Buat Varian Baru)</span>
              </button>
            </div>
          </div>
        ) : (
          /* =========================================================================
              TAMPILAN 2: CUSTOMIZE (FORM PEMILIHAN VARIAN/OPSI)
             ========================================================================= */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header Navigasi jika sebelumnya sudah ada item di keranjang */}
            {existingItems.length > 0 && (
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("manage")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Kembali ke Pilihan ({existingItems.length})</span>
                </button>
              </div>
            )}

            <div className="overflow-y-auto flex-1">
              <ProductImage
                product={product}
                className="aspect-[16/10]"
                emojiClassName="text-8xl"
                sizes="(min-width: 768px) 512px, 100vw"
              />

              <div className="space-y-5 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{product.categoryName}</span>
                    <StockBadge status={status} />
                  </div>
                  <h2 className="mt-1 text-xl font-bold">{product.name}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
                  <p className="mt-2 text-lg font-bold text-primary">{formatRupiah(product.basePrice)}</p>
                </div>

                {product.options.map((g) => (
                  <fieldset key={g.id}>
                    <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold">
                      {g.name}
                      <span className="text-xs font-medium text-muted-foreground">
                        {g.required ? "Wajib dipilih" : "Opsional"}
                      </span>
                    </legend>
                    <div className="space-y-2">
                      {g.items.map((item) => {
                        const checked = selected[g.id]?.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "flex min-h-11 cursor-pointer items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors",
                              checked ? "border-primary bg-primary/5" : "border-border hover:bg-secondary-bg",
                            )}
                          >
                            <span className="flex items-center gap-3">
                              <input
                                type={g.type === "single" ? "radio" : "checkbox"}
                                name={g.id}
                                checked={!!checked}
                                onChange={() => toggle(g.id, item.id, g.type)}
                                className="size-4 accent-primary"
                              />
                              {item.name}
                            </span>
                            {item.price > 0 && (
                              <span className="text-muted-foreground">+{formatRupiah(item.price)}</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}

                <div>
                  <label htmlFor="item-note" className="mb-2 block text-sm font-semibold">Catatan Khusus</label>
                  <textarea
                    id="item-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 255))}
                    rows={2}
                    placeholder="Contoh: jangan terlalu pedas, telur setengah matang"
                    className="w-full resize-none rounded-xl border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Bar: Jumlah & Tombol Tambah ke Keranjang */}
            <div className="flex items-center gap-3 border-t border-border bg-white p-4">
              <div className="flex items-center rounded-full border border-border">
                <button
                  type="button"
                  aria-label="Kurangi jumlah"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => q - 1)}
                  className="flex size-11 items-center justify-center rounded-full hover:bg-secondary-bg disabled:opacity-40"
                >
                  <Minus className="size-4" aria-hidden />
                </button>
                <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  aria-label="Tambah jumlah"
                  disabled={quantity >= product.availableQty}
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex size-11 items-center justify-center rounded-full hover:bg-secondary-bg disabled:opacity-40"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
              <button
                type="button"
                onClick={submitNew}
                disabled={missingRequired}
                className="h-11 flex-1 rounded-full bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                Tambah · {formatRupiah(unitPrice * quantity)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

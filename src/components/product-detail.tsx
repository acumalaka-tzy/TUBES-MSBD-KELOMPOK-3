"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { getStockStatus, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

/**
 * Detail produk: Modal Dialog di Desktop, Bottom Sheet di Mobile (PRD 5.3).
 * Komponen ini di-mount hanya saat dibuka, sehingga state selalu mulai dari default.
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
  const { addItem } = useCart();
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

  function submit() {
    // Format mengikuti CartContext tim: unitPrice = harga dasar, opsi dipisah + priceAdjustment
    addItem({
      productId: product.id,
      name: product.name,
      unitPrice: product.basePrice,
      quantity,
      options: chosen.map((i) => ({ groupName: i.group, optionName: i.name, priceAdjustment: i.price })),
      itemNotes: note.trim() || undefined,
    });
    onAdded?.(`${quantity}× ${product.name} ditambahkan ke keranjang`);
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail"
          className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
        >
          <X className="size-5" aria-hidden />
        </button>

        <div className="overflow-y-auto">
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
              <h2 id="product-detail-title" className="mt-1 text-xl font-bold">{product.name}</h2>
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
              <label htmlFor="item-note" className="mb-2 block text-sm font-semibold">Catatan</label>
              <textarea
                id="item-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 255))}
                rows={2}
                placeholder="Contoh: gula dikurangi"
                className="w-full resize-none rounded-xl border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
          </div>
        </div>

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
            onClick={submit}
            disabled={missingRequired}
            className="h-11 flex-1 rounded-full bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Tambah · {formatRupiah(unitPrice * quantity)}
          </button>
        </div>
      </div>
    </div>
  );
}

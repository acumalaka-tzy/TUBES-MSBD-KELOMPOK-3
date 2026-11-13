"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Edit3, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCart, type CartItem } from "@/context/cart-context";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { getStockStatus, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

/**
 * Detail produk & Alur GrabFood (PRD 5.3):
 * 1. Mode "manage": Menampilkan varian yang sudah ada di keranjang + tombol "+ Buat Varian Baru".
 *    Mengklik salah satu kartu pesanan akan masuk ke mode edit varian tersebut.
 * 2. Mode "customize": Form pemilihan opsi/varian (Bisa untuk varian baru atau edit varian yang ada).
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
  const { items, addItem, updateItem, updateQuantity } = useCart();
  const existingItems = items.filter((it) => it.productId === product.id);

  // Jika produk sudah ada di keranjang, buka tampilan riwayat & "Make another" (seperti GrabFood)
  const [viewMode, setViewMode] = useState<"manage" | "customize">(
    existingItems.length > 0 ? "manage" : "customize",
  );

  // ID item keranjang yang sedang diedit (null jika membuat varian baru)
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);

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
      setEditingCartItemId(null);
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

  function handleStartNew() {
    setEditingCartItemId(null);
    setSelected(
      Object.fromEntries(
        product.options.map((g) => [g.id, g.type === "single" && g.required ? [g.items[0].id] : []]),
      ),
    );
    setQuantity(1);
    setNote("");
    setViewMode("customize");
  }

  function handleStartEdit(cartItem: CartItem) {
    setEditingCartItemId(cartItem.id);

    // Cari opsi yang sesuai dengan cartItem.options
    const newSelected: Record<string, string[]> = {};
    product.options.forEach((g) => {
      const matchedIds = g.items
        .filter((item) =>
          cartItem.options.some((opt) => opt.groupName === g.name && opt.optionName === item.name),
        )
        .map((item) => item.id);

      if (matchedIds.length > 0) {
        newSelected[g.id] = matchedIds;
      } else if (g.type === "single" && g.required && g.items.length > 0) {
        newSelected[g.id] = [g.items[0].id];
      } else {
        newSelected[g.id] = [];
      }
    });

    setSelected(newSelected);
    setQuantity(cartItem.quantity);
    setNote(cartItem.itemNotes || "");
    setViewMode("customize");
  }

  function handleSubmit() {
    const formattedOptions = chosen.map((i) => ({
      groupName: i.group,
      optionName: i.name,
      priceAdjustment: i.price,
    }));

    if (editingCartItemId) {
      // Perbarui item yang sudah ada di keranjang
      updateItem(editingCartItemId, {
        productId: product.id,
        name: product.name,
        unitPrice: product.basePrice,
        quantity,
        options: formattedOptions,
        itemNotes: note.trim() || undefined,
      });
      onAdded?.(`Pesanan ${product.name} berhasil diperbarui`);
    } else {
      // Tambah sebagai varian baru
      addItem({
        productId: product.id,
        name: product.name,
        unitPrice: product.basePrice,
        quantity,
        options: formattedOptions,
        itemNotes: note.trim() || undefined,
      });
      onAdded?.(`${quantity}× ${product.name} varian baru ditambahkan ke keranjang`);
    }
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

        {/* =========================================================================
            TAMPILAN 1: MANAGE / MAKE ANOTHER (GAYA GRABFOOD)
           ========================================================================= */}
        {viewMode === "manage" ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header Produk Ringkas (Tombol silang diletakkan terpisah rapi di kanan, tidak menutupi teks) */}
            <div className="flex items-start justify-between gap-3 p-5 pb-3.5 border-b border-border">
              <div className="min-w-0 flex-1">
                <h2 id="product-detail-title" className="text-xl font-black text-foreground truncate">
                  {product.name}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Harga dasar:{" "}
                  <strong className="font-mono text-xs font-black text-foreground">
                    {formatRupiah(product.basePrice)}
                  </strong>
                </p>
              </div>

              {/* Tombol Tutup (Di dalam header, tidak menutupi teks) */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup detail"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-bg hover:bg-border/60 text-foreground transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {/* List Item yang Sudah Berada di Keranjang (Scrollbar disembunyikan / no-scrollbar) */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                  <span>Pilihan yang Sedang di Keranjang ({existingItems.length})</span>
                </span>
                <span className="text-[10px] lowercase font-normal italic text-muted-foreground">
                  (klik item untuk edit varian)
                </span>
              </div>

              <div className="space-y-3">
                {existingItems.map((cartItem) => (
                  <div
                    key={cartItem.id}
                    onClick={() => handleStartEdit(cartItem)}
                    className="group flex items-start justify-between gap-3 p-4 rounded-2xl border border-border bg-secondary-bg/50 hover:bg-white hover:border-primary/50 hover:shadow-xs transition-all cursor-pointer"
                    title="Klik untuk mengubah varian/catatan pesanan ini"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="size-14 rounded-xl overflow-hidden shrink-0 border border-border bg-white flex items-center justify-center">
                        <ProductImage product={product} className="size-full" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {cartItem.name}
                          </p>
                          <Edit3 className="size-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </div>
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

                    {/* Quantity Control Pill */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center border border-border rounded-full bg-white p-0.5 shadow-2xs shrink-0"
                    >
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

            {/* Tombol Utama: BUAT VARIAN BARU */}
            <div className="border-t border-border bg-white p-4">
              <button
                type="button"
                onClick={handleStartNew}
                className="h-12 w-full rounded-2xl bg-primary hover:bg-primary-hover text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>+ Buat Varian Baru</span>
              </button>
            </div>
          </div>
        ) : (
          /* =========================================================================
              TAMPILAN 2: CUSTOMIZE (FORM PEMILIHAN VARIAN/OPSI - EDIT / BARU)
             ========================================================================= */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header Navigasi jika sebelumnya sudah ada item di keranjang */}
            {existingItems.length > 0 ? (
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCartItemId(null);
                    setViewMode("manage");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>
                    {editingCartItemId ? "Batal Ubah" : `Kembali ke Pilihan (${existingItems.length})`}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  {editingCartItemId && (
                    <span className="text-[11px] font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                      Mode Edit Varian
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Tutup detail"
                    className="flex size-7 items-center justify-center rounded-full bg-secondary-bg hover:bg-border/60 text-foreground transition-colors"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            ) : (
              /* Tombol Tutup jika item belum pernah ditambahkan ke keranjang */
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup detail"
                className="absolute right-3.5 top-3.5 z-20 flex size-9 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}

            {/* Kontainer Form Varian (Scrollbar disembunyikan / no-scrollbar) */}
            <div className="overflow-y-auto no-scrollbar flex-1">
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

            {/* Bottom Bar: Jumlah & Tombol Simpan Perubahan / Tambah ke Keranjang */}
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
                onClick={handleSubmit}
                disabled={missingRequired}
                className="h-11 flex-1 rounded-full bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {editingCartItemId ? (
                  <span>Simpan Perubahan · {formatRupiah(unitPrice * quantity)}</span>
                ) : (
                  <span>Tambah · {formatRupiah(unitPrice * quantity)}</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

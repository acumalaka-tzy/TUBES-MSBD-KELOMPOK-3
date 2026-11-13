"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Flame,
  Info,
  MessageSquarePlus,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { useCart, type CartOption } from "@/context/cart-context";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { getStockStatus, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

export interface ProductDetailInitialEdit {
  cartItemId: string;
  quantity: number;
  options: CartOption[];
  itemNotes?: string;
}

function getQuickNoteSuggestions(product: Product): string[] {
  const text = `${product.name} ${product.categoryName}`.toLowerCase();
  if (/kopi|sanger|teh|minum|dingin|jeruk|milo|badak/.test(text)) {
    return [
      "Gula dikurangi",
      "Es batu sedikit",
      "Gula dipisah",
      "Kopi lebih kental",
      " disajikan hangat",
    ].map((s) => s.trim());
  }
  if (/mie|indomie|nasi|aceh|makanan/.test(text)) {
    return [
      "Kuah dipisah",
      "Tanpa bawang goreng",
      "Telur matang sempurna",
      "Acar & cabai pisah",
      "Bumbu lebih lekoh",
    ];
  }
  return [
    "Potong kecil-kecil",
    "Susu/selai dipisah",
    "Panggang lebih garing",
    "Sajikan hangat",
  ];
}

/**
 * Detail produk: Modal Dialog di Desktop, Bottom Sheet Drawer di Mobile (PRD 5.3 & 10.1).
 * Mendukung mode tambah item baru maupun edit item yang sudah ada di Keranjang.
 */
export function ProductDetail({
  product,
  onClose,
  onAdded,
  initialEditItem,
}: {
  product: Product;
  onClose: () => void;
  onAdded?: (message: string) => void;
  initialEditItem?: ProductDetailInitialEdit;
}) {
  const { addItem, updateItem, getProductCartQuantity, openCart } = useCart();
  const isEditMode = !!initialEditItem;

  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    if (initialEditItem) {
      return Object.fromEntries(
        product.options.map((g) => {
          const matchedIds = g.items
            .filter((item) =>
              initialEditItem.options.some(
                (opt) => opt.groupName === g.name && opt.optionName === item.name,
              ),
            )
            .map((item) => item.id);
          if (matchedIds.length > 0) return [g.id, matchedIds];
          return [g.id, g.type === "single" && g.required && g.items[0] ? [g.items[0].id] : []];
        }),
      );
    }
    return Object.fromEntries(
      product.options.map((g) => [
        g.id,
        g.type === "single" && g.required && g.items[0] ? [g.items[0].id] : [],
      ]),
    );
  });

  const alreadyInCartQty = getProductCartQuantity(product.id, initialEditItem?.cartItemId);
  const maxAllowedQty = Math.max(0, product.availableQty - alreadyInCartQty);

  const [quantity, setQuantity] = useState(() => {
    if (initialEditItem) {
      return Math.max(1, Math.min(initialEditItem.quantity, Math.max(1, maxAllowedQty)));
    }
    return 1;
  });
  const [note, setNote] = useState(initialEditItem?.itemNotes ?? "");

  // Drag-to-close gesture untuk Bottom Sheet di Mobile
  const touchStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

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
  const soldOut = status === "OUT_OF_STOCK";
  const quickSuggestions = useMemo(() => getQuickNoteSuggestions(product), [product]);

  const chosen = useMemo(
    () =>
      product.options.flatMap((g) =>
        g.items
          .filter((i) => selected[g.id]?.includes(i.id))
          .map((i) => ({ group: g.name, ...i })),
      ),
    [product.options, selected],
  );

  const optionsTotal = chosen.reduce((s, i) => s + i.price, 0);
  const unitPrice = product.basePrice + optionsTotal;
  const totalPrice = unitPrice * quantity;
  const missingRequired = product.options.some((g) => g.required && !selected[g.id]?.length);
  const canSubmit = !soldOut && !missingRequired && maxAllowedQty > 0 && quantity >= 1;

  function toggle(groupId: string, itemId: string, type: "single" | "multi") {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (type === "single") return { ...prev, [groupId]: [itemId] };
      return {
        ...prev,
        [groupId]: current.includes(itemId)
          ? current.filter((i) => i !== itemId)
          : [...current, itemId],
      };
    });
  }

  function resetGroup(groupId: string) {
    setSelected((prev) => ({ ...prev, [groupId]: [] }));
  }

  function toggleQuickNote(chip: string) {
    setNote((prev) => {
      const parts = prev
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const exists = parts.some((p) => p.toLowerCase() === chip.toLowerCase());
      const next = exists
        ? parts.filter((p) => p.toLowerCase() !== chip.toLowerCase()).join(", ")
        : [...parts, chip].join(", ");
      return next.slice(0, 255);
    });
  }

  function isChipActive(chip: string) {
    return note
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .includes(chip.toLowerCase());
  }

  function submit() {
    if (!canSubmit) return;

    const payload = {
      productId: product.id,
      name: product.name,
      unitPrice: product.basePrice,
      quantity,
      options: chosen.map((i) => ({
        groupName: i.group,
        optionName: i.name,
        priceAdjustment: i.price,
      })),
      itemNotes: note.trim() || undefined,
      imageUrl: product.imageUrl,
      emoji: product.emoji,
      categoryName: product.categoryName,
      maxStock: product.availableQty,
    };

    if (isEditMode && initialEditItem) {
      updateItem(initialEditItem.cartItemId, payload);
      onAdded?.(`Pilihan ${product.name} berhasil diperbarui`);
      onClose();
      return;
    }

    const res = addItem(payload);
    if (res.added > 0) {
      onAdded?.(`${res.added}× ${product.name} ditambahkan ke keranjang`);
    } else {
      onAdded?.(`Stok maksimal ${product.name} sudah berada di keranjang`);
    }
    onClose();
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setDragOffset(Math.min(delta, 220));
    }
  }

  function handleTouchEnd() {
    if (dragOffset > 85) {
      onClose();
    } else {
      setDragOffset(0);
    }
    touchStartY.current = null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity"
      />

      {/* Modal Desktop / Bottom Sheet Mobile */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        style={dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        className="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl transition-transform duration-150 md:max-h-[88dvh] md:max-w-xl md:rounded-3xl"
      >
        {/* Drag Handle Bar (khusus Bottom Sheet Mobile) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex cursor-grab items-center justify-center pb-1.5 pt-2.5 active:cursor-grabbing md:hidden"
        >
          <div className="h-1.5 w-12 rounded-full bg-border" aria-hidden />
        </div>

        {/* Tombol Tutup Floating */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail"
          className="absolute right-3.5 top-3.5 z-20 flex size-10 items-center justify-center rounded-full border border-border/60 bg-white/90 text-foreground shadow-md backdrop-blur transition-transform hover:scale-105 hover:bg-white"
        >
          <X className="size-5" aria-hidden />
        </button>

        {/* Konten Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Foto Produk Besar & Badge Overlay */}
          <div className="relative">
            <ProductImage
              product={product}
              className={cn("aspect-[16/10]", soldOut && "grayscale")}
              emojiClassName="text-8xl"
              sizes="(min-width: 768px) 576px, 100vw"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />

            {/* Badges Kiri Atas */}
            <div className="absolute left-3.5 top-3.5 flex flex-wrap items-center gap-1.5 pr-14">
              {product.bestSeller && !soldOut && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-md">
                  <Flame className="size-3.5" aria-hidden />
                  Best Seller
                </span>
              )}
              {isEditMode && (
                <span className="inline-flex items-center gap-1 rounded-full bg-foreground/90 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur">
                  <Sparkles className="size-3" aria-hidden />
                  Mode Ubah Pilihan
                </span>
              )}
            </div>

            {/* Kategori & Status Stok di Atas Foto Bawah */}
            <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-foreground shadow-sm backdrop-blur">
                <span aria-hidden>{product.emoji}</span>
                <span>{product.categoryName}</span>
              </span>
              <StockBadge status={status} className="shadow-sm backdrop-blur bg-white/95" />
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {/* Judul, Deskripsi & Harga */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2
                  id="product-detail-title"
                  className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl"
                >
                  {product.name}
                </h2>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-lg font-black text-primary sm:text-xl">
                    {formatRupiah(unitPrice)}
                  </p>
                  {optionsTotal > 0 && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Dasar {formatRupiah(product.basePrice)} + Varian {formatRupiah(optionsTotal)}
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>

              {/* Bar Informasi Stok Real-Time & Keranjang */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-secondary-bg/70 px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <PackageCheck
                    className={cn(
                      "size-4 shrink-0",
                      soldOut
                        ? "text-error"
                        : status === "LOW_STOCK"
                          ? "text-warning"
                          : "text-success",
                    )}
                    aria-hidden
                  />
                  <span className="text-muted-foreground">
                    Ketersediaan hari ini:{" "}
                    <strong className="font-mono font-bold text-foreground">
                      {product.availableQty} porsi
                    </strong>
                  </span>
                </div>

                {alreadyInCartQty > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openCart();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-bold text-primary transition-colors hover:bg-primary/20"
                  >
                    <ShoppingBag className="size-3" aria-hidden />
                    <span>{alreadyInCartQty} di keranjang</span>
                  </button>
                )}
              </div>
            </div>

            {/* Pilihan Varian / Topping */}
            {product.options.length > 0 ? (
              <div className="space-y-4">
                {product.options.map((g) => {
                  const selectedIds = selected[g.id] ?? [];
                  const isSatisfied = !g.required || selectedIds.length > 0;

                  return (
                    <fieldset
                      key={g.id}
                      className="rounded-2xl border border-border bg-secondary-bg/35 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <legend className="text-sm font-extrabold text-foreground">
                            {g.name}
                          </legend>
                          <p className="text-[11px] text-muted-foreground">
                            {g.type === "single"
                              ? "Pilih 1 opsi penyajian"
                              : `Opsional • Bisa pilih hingga ${g.items.length} tambahan`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {g.type === "multi" && selectedIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => resetGroup(g.id)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-border/60 hover:text-foreground"
                            >
                              <RotateCcw className="size-3" aria-hidden />
                              Reset
                            </button>
                          )}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                              g.required
                                ? isSatisfied
                                  ? "bg-success/15 text-success"
                                  : "bg-warning/20 text-[#9A6A12]"
                                : selectedIds.length > 0
                                  ? "bg-primary/15 text-primary"
                                  : "bg-secondary-bg text-muted-foreground",
                            )}
                          >
                            {g.required ? (
                              isSatisfied ? (
                                <>
                                  <Check className="size-3" aria-hidden />
                                  Wajib • Terpilih
                                </>
                              ) : (
                                "Wajib dipilih"
                              )
                            ) : selectedIds.length > 0 ? (
                              `${selectedIds.length} dipilih`
                            ) : (
                              "Opsional"
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {g.items.map((item) => {
                          const checked = selectedIds.includes(item.id);
                          return (
                            <label
                              key={item.id}
                              className={cn(
                                "group relative flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-all",
                                checked
                                  ? "border-primary bg-primary/8 shadow-2xs ring-1 ring-primary/30"
                                  : "border-border bg-white hover:border-primary/40 hover:bg-secondary-bg/60",
                                soldOut && "pointer-events-none opacity-60",
                              )}
                            >
                              <span className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type={g.type === "single" ? "radio" : "checkbox"}
                                  name={g.id}
                                  checked={!!checked}
                                  disabled={soldOut}
                                  onChange={() => toggle(g.id, item.id, g.type)}
                                  className="sr-only"
                                />
                                <span
                                  aria-hidden
                                  className={cn(
                                    "flex size-4.5 shrink-0 items-center justify-center border transition-colors",
                                    g.type === "single" ? "rounded-full" : "rounded-md",
                                    checked
                                      ? "border-primary bg-primary text-white"
                                      : "border-muted-foreground/40 bg-white group-hover:border-primary",
                                  )}
                                >
                                  {checked &&
                                    (g.type === "single" ? (
                                      <span className="size-2 rounded-full bg-white" />
                                    ) : (
                                      <Check className="size-3 stroke-[3]" />
                                    ))}
                                </span>
                                <span
                                  className={cn(
                                    "truncate font-semibold",
                                    checked ? "text-foreground" : "text-foreground/85",
                                  )}
                                >
                                  {item.name}
                                </span>
                              </span>

                              <span
                                className={cn(
                                  "shrink-0 font-mono text-xs font-bold",
                                  item.price > 0
                                    ? checked
                                      ? "text-primary"
                                      : "text-muted-foreground"
                                    : "text-[11px] font-medium text-muted-foreground/70",
                                )}
                              >
                                {item.price > 0 ? `+${formatRupiah(item.price)}` : "Gratis"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-secondary-bg/50 px-4 py-3 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Menu ini disajikan sesuai takaran standar terbaik Warkop Agam. Anda tetap dapat
                  menambahkan permintaan khusus pada kolom catatan di bawah.
                </span>
              </div>
            )}

            {/* Catatan Khusus Item + Quick Suggestion Chips */}
            <div className="rounded-2xl border border-border bg-secondary-bg/35 p-4">
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="item-note"
                  className="flex items-center gap-1.5 text-sm font-extrabold text-foreground"
                >
                  <MessageSquarePlus className="size-4 text-primary" aria-hidden />
                  <span>Catatan Khusus Item</span>
                  <span className="text-xs font-normal text-muted-foreground">(Opsional)</span>
                </label>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {note.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setNote("")}
                      className="font-semibold text-primary hover:underline"
                    >
                      Bersihkan
                    </button>
                  )}
                  <span className="font-mono">{note.length}/255</span>
                </div>
              </div>

              {/* Chip Saran Catatan Cepat */}
              {!soldOut && (
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {quickSuggestions.map((chip) => {
                    const active = isChipActive(chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => toggleQuickNote(chip)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all",
                          active
                            ? "border-primary bg-primary text-white shadow-2xs"
                            : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        <span>{active ? "✓" : "+"}</span>
                        <span>{chip}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <textarea
                id="item-note"
                value={note}
                disabled={soldOut}
                onChange={(e) => setNote(e.target.value.slice(0, 255))}
                rows={2}
                placeholder="Contoh: gula dikurangi, kuah dipisah, jangan pakai bawang..."
                className="w-full resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Sticky Footer: Ringkasan Kalkulasi + Stepper Jumlah + Tombol Aksi */}
        <div className="border-t border-border bg-white px-5 py-3.5 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.12)]">
          {/* Bar Ringkasan Pilihan Aktif */}
          {(chosen.length > 0 || quantity > 1) && !soldOut && (
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary-bg px-3 py-1.5 text-xs">
              <span className="truncate text-muted-foreground">
                {chosen.length > 0
                  ? `Pilihan: ${chosen.map((c) => c.name).join(", ")}`
                  : `${quantity} porsi × ${formatRupiah(unitPrice)}`}
              </span>
              <span className="shrink-0 font-mono font-bold text-foreground">
                {quantity} × {formatRupiah(unitPrice)}
              </span>
            </div>
          )}

          {soldOut ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Maaf, stok porsi menu ini sedang habis untuk hari ini.
              </p>
              <button
                type="button"
                disabled
                className="h-11 shrink-0 rounded-xl bg-error/15 px-5 text-xs font-extrabold text-error"
              >
                Stok Habis
              </button>
            </div>
          ) : maxAllowedQty <= 0 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Seluruh stok tersedia ({product.availableQty} porsi) sudah ada di keranjang Anda.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openCart();
                }}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-sm hover:bg-primary-hover"
              >
                <ShoppingBag className="size-4" aria-hidden />
                <span>Lihat Keranjang</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {/* Stepper Jumlah Porsi */}
              <div className="flex items-center rounded-2xl border border-border bg-secondary-bg p-0.5">
                <button
                  type="button"
                  aria-label="Kurangi jumlah"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-white hover:text-primary disabled:opacity-40"
                >
                  <Minus className="size-4" aria-hidden />
                </button>
                <span
                  className="w-9 text-center font-mono text-sm font-extrabold text-foreground"
                  aria-live="polite"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Tambah jumlah"
                  disabled={quantity >= maxAllowedQty}
                  onClick={() => setQuantity((q) => Math.min(maxAllowedQty, q + 1))}
                  className="flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-white hover:text-primary disabled:opacity-40"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>

              {/* Tombol Tambah / Simpan ke Keranjang */}
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="flex h-11 flex-1 items-center justify-between gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-white shadow-md transition-all hover:bg-primary-hover disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag className="size-4" aria-hidden />
                  <span>{isEditMode ? "Simpan Perubahan" : "Tambah Pesanan"}</span>
                </span>
                <span className="font-mono text-sm font-extrabold">
                  {formatRupiah(totalPrice)}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Edit3,
  FileText,
  Minus,
  Package,
  Plus,
  QrCode,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useCart, type CartItem } from "@/context/cart-context";
import { ProductDetail } from "@/components/product-detail";
import { ProductImage } from "@/components/product-image";
import { useActiveTable } from "@/lib/active-table";
import { sampleProducts, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    items,
    addItem,
    updateQuantity,
    updateItemNotes,
    removeItem,
    clearCart,
    loadSampleItems,
    getProductCartQuantity,
    getProductMaxStock,
    subtotal,
    taxAmount,
    totalAmount,
    itemCount,
    serviceType,
    setServiceType,
    orderNotes,
    setOrderNotes,
    taxLabel,
    storeSettings,
  } = useCart();

  const table = useActiveTable();
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [showOrderNotes, setShowOrderNotes] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState<{
    product: Product;
    item: CartItem;
  } | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  const effectiveServiceType = table ? "DINE_IN" : serviceType;
  const checkoutHref = useMemo(() => {
    const params = new URLSearchParams();
    if (table) params.set("table", table);
    params.set("service", effectiveServiceType);
    const qs = params.toString();
    return qs ? `/checkout?${qs}` : "/checkout";
  }, [table, effectiveServiceType]);

  // Rekomendasi menu pendamping yang belum ada di keranjang
  const recommendations = useMemo(() => {
    const inCartIds = new Set(items.map((i) => i.productId));
    return sampleProducts
      .filter((p) => p.availableQty > 0 && !inCartIds.has(p.id))
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 3);
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingCartItem && !previewProduct) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, editingCartItem, previewProduct]);

  function startEditNote(item: CartItem) {
    setEditingNoteId(item.id);
    setNoteDraft(item.itemNotes ?? "");
  }

  function saveEditNote(itemId: string) {
    updateItemNotes(itemId, noteDraft);
    setEditingNoteId(null);
    setNoteDraft("");
  }

  function openVariantEditor(item: CartItem) {
    const found = sampleProducts.find((p) => p.id === item.productId);
    const productObj: Product = found ?? {
      id: item.productId,
      categoryId: "cat-custom",
      categoryName: item.categoryName ?? "Menu Pilihan",
      name: item.name,
      description: "Sesuaikan jumlah porsi dan catatan khusus untuk menu ini.",
      basePrice: item.unitPrice,
      emoji: item.emoji ?? "🍽️",
      imageUrl: item.imageUrl,
      availableQty: getProductMaxStock(item.productId, item.maxStock),
      minThreshold: 5,
      popularity: 90,
      options: [],
    };
    setEditingCartItem({ product: productObj, item });
  }

  function handleQuickAddRecommendation(product: Product) {
    // Jika produk memiliki opsi wajib, langsung pilihkan default atau buka modal
    const defaultOptions = product.options.flatMap((g) =>
      g.required && g.items[0]
        ? [{ groupName: g.name, optionName: g.items[0].name, priceAdjustment: g.items[0].price }]
        : [],
    );
    addItem({
      productId: product.id,
      name: product.name,
      unitPrice: product.basePrice,
      quantity: 1,
      options: defaultOptions,
      imageUrl: product.imageUrl,
      emoji: product.emoji,
      categoryName: product.categoryName,
      maxStock: product.availableQty,
    });
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-end md:items-stretch">
        <button
          type="button"
          aria-label="Tutup keranjang"
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-drawer-title"
          className="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:h-full md:max-h-none md:max-w-md md:rounded-none"
        >
          {/* Handle Bar Mobile */}
          <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-border md:hidden" aria-hidden />

          {/* Header Keranjang */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShoppingBag className="size-5" aria-hidden />
              </span>
              <div>
                <h2 id="cart-drawer-title" className="text-base font-extrabold leading-tight text-foreground">
                  Keranjang Belanja
                </h2>
                <p className="text-xs text-muted-foreground">
                  <strong className="font-bold text-foreground">{itemCount} porsi</strong> ({items.length}{" "}
                  menu){table ? ` • Meja ${table}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {items.length > 0 && !confirmClear && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-error transition-colors hover:bg-error/10"
                >
                  Kosongkan
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="flex size-9 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-secondary-bg"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Konfirmasi Kosongkan Keranjang */}
          {confirmClear && items.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-b border-error/20 bg-error/10 px-5 py-2.5 text-xs">
              <span className="font-semibold text-error">Hapus semua item di keranjang?</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    clearCart();
                    setConfirmClear(false);
                  }}
                  className="rounded-lg bg-error px-2.5 py-1 font-bold text-white hover:opacity-90"
                >
                  Ya, Kosongkan
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg border border-border bg-white px-2.5 py-1 font-semibold text-foreground hover:bg-secondary-bg"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Pilihan Tipe Layanan (Dine In vs Takeaway) sesuai PRD 5.4 */}
          {items.length > 0 && (
            <div className="border-b border-border bg-secondary-bg/60 px-5 py-3">
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-white p-1">
                <button
                  type="button"
                  onClick={() => setServiceType("DINE_IN")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all",
                    effectiveServiceType === "DINE_IN"
                      ? "bg-primary text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Utensils className="size-3.5" aria-hidden />
                  <span>Dine In {table ? `(Meja ${table})` : ""}</span>
                </button>
                <button
                  type="button"
                  disabled={!!table}
                  onClick={() => setServiceType("TAKEAWAY")}
                  title={table ? `Terkunci untuk Dine In Meja ${table}` : undefined}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all",
                    effectiveServiceType === "TAKEAWAY"
                      ? "bg-primary text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                    table && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Package className="size-3.5" aria-hidden />
                  <span>Takeaway (Bungkus)</span>
                </button>
              </div>

              {table ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                  <QrCode className="size-3.5 shrink-0" aria-hidden />
                  <span>Identitas meja terkunci otomatis dari QR Meja {table}.</span>
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {effectiveServiceType === "DINE_IN"
                    ? "Nomor meja akan dipilih/dikonfirmasi pada langkah Checkout."
                    : "Pesanan dibungkus rapi — isi nama & WhatsApp saat Checkout."}
                </p>
              )}
            </div>
          )}

          {/* Daftar Item Keranjang */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary-bg text-primary">
                  <ShoppingBag className="size-7" aria-hidden />
                </div>
                <p className="mt-3.5 text-base font-extrabold text-foreground">
                  Keranjang Anda masih kosong
                </p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Pilih hidangan khas Aceh &amp; Medan di Katalog Menu atau muat contoh pesanan untuk
                  langsung mencoba alur transaksi.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Link
                    href="/menu"
                    onClick={onClose}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-sm hover:bg-primary-hover"
                  >
                    <span>Lihat Katalog Menu</span>
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    onClick={loadSampleItems}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-secondary-bg px-3.5 text-xs font-bold text-foreground hover:bg-border/60"
                  >
                    <Sparkles className="size-3.5 text-primary" aria-hidden />
                    <span>Muat Contoh Pesanan</span>
                  </button>
                </div>

                {/* Rekomendasi Cepat Saat Kosong */}
                {recommendations.length > 0 && (
                  <div className="mt-8 w-full border-t border-border pt-5 text-left">
                    <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      Rekomendasi Terpopuler
                    </p>
                    <div className="space-y-2">
                      {recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary-bg/40 p-2.5"
                        >
                          <button
                            type="button"
                            onClick={() => setPreviewProduct(rec)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                          >
                            <ProductImage
                              product={rec}
                              className="size-11 shrink-0 rounded-lg"
                              emojiClassName="text-xl"
                              sizes="44px"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-foreground">{rec.name}</p>
                              <p className="font-mono text-[11px] font-bold text-primary">
                                {formatRupiah(rec.basePrice)}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewProduct(rec)}
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-white hover:bg-primary-hover"
                          >
                            <Plus className="size-3" aria-hidden />
                            <span>Pilih</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const maxStock = getProductMaxStock(item.productId, item.maxStock);
                  const totalProductQty = getProductCartQuantity(item.productId);
                  const atMaxStock = totalProductQty >= maxStock;
                  const optionsSum = item.options.reduce(
                    (s, o) => s + (Number(o.priceAdjustment) || 0),
                    0,
                  );
                  const unitWithOpts = item.unitPrice + optionsSum;
                  const isEditingThisNote = editingNoteId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border bg-white p-3.5 shadow-2xs transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-start gap-3">
                        {/* Thumbnail Produk */}
                        <button
                          type="button"
                          onClick={() => openVariantEditor(item)}
                          aria-label={`Ubah ${item.name}`}
                          className="group relative shrink-0 overflow-hidden rounded-xl border border-border"
                        >
                          <ProductImage
                            product={{
                              id: item.productId,
                              name: item.name,
                              emoji: item.emoji ?? "🍽️",
                              imageUrl: item.imageUrl,
                            }}
                            className="size-16"
                            emojiClassName="text-2xl"
                            sizes="64px"
                          />
                        </button>

                        {/* Detail Nama, Varian, Harga */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openVariantEditor(item)}
                              className="truncate text-left text-sm font-extrabold text-foreground hover:text-primary"
                            >
                              {item.name}
                            </button>
                            <button
                              type="button"
                              aria-label={`Hapus ${item.name}`}
                              onClick={() => removeItem(item.id)}
                              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </div>

                          {/* Daftar Varian Terpilih */}
                          {item.options && item.options.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.options.map((o, idx) => (
                                <span
                                  key={`${o.groupName}-${o.optionName}-${idx}`}
                                  className="inline-flex items-center rounded-md bg-secondary-bg px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                                >
                                  {o.optionName}
                                  {o.priceAdjustment > 0 && (
                                    <span className="ml-1 font-mono text-[10px] font-bold text-primary">
                                      +{formatRupiah(o.priceAdjustment)}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Harga Satuan */}
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {formatRupiah(unitWithOpts)} / porsi
                          </p>
                        </div>
                      </div>

                      {/* Catatan Item Inline Editor (PRD 5.4) */}
                      {isEditingThisNote ? (
                        <div className="mt-2.5 rounded-xl border border-primary/40 bg-secondary-bg/60 p-2.5">
                          <label className="mb-1 block text-[11px] font-bold text-foreground">
                            Catatan untuk {item.name}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value.slice(0, 255))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveEditNote(item.id);
                                } else if (e.key === "Escape") {
                                  setEditingNoteId(null);
                                }
                              }}
                              placeholder="Contoh: gula dikurangi, kuah pisah..."
                              autoFocus
                              className="h-8 flex-1 rounded-lg border border-border bg-white px-2.5 text-xs outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={() => saveEditNote(item.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-bold text-white hover:bg-primary-hover"
                            >
                              <Check className="size-3.5" aria-hidden />
                              <span>Simpan</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                          {/* Tombol Ubah Varian & Ubah Catatan */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openVariantEditor(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary-bg/70 px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            >
                              <SlidersHorizontal className="size-3 text-primary" aria-hidden />
                              <span>Ubah Varian</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => startEditNote(item)}
                              className={cn(
                                "inline-flex max-w-[170px] items-center gap-1 truncate rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors",
                                item.itemNotes
                                  ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                                  : "border-border bg-white text-muted-foreground hover:text-foreground",
                              )}
                              title={item.itemNotes || "Tambah catatan khusus item"}
                            >
                              <Edit3 className="size-3 shrink-0" aria-hidden />
                              <span className="truncate">
                                {item.itemNotes ? `"${item.itemNotes}"` : "+ Catatan"}
                              </span>
                            </button>
                          </div>

                          {/* Stepper Jumlah & Subtotal Item */}
                          <div className="flex items-center gap-2.5 ml-auto">
                            <span className="font-mono text-xs font-extrabold text-foreground">
                              {formatRupiah(item.subtotal)}
                            </span>

                            <div className="flex items-center rounded-xl border border-border bg-secondary-bg p-0.5">
                              <button
                                type="button"
                                aria-label={`Kurangi ${item.name}`}
                                onClick={() => updateQuantity(item.id, -1)}
                                className="flex size-7 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-white hover:text-primary"
                              >
                                <Minus className="size-3.5" aria-hidden />
                              </button>
                              <span className="w-6 text-center font-mono text-xs font-extrabold">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                aria-label={`Tambah ${item.name}`}
                                disabled={atMaxStock}
                                onClick={() => updateQuantity(item.id, 1)}
                                className="flex size-7 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-white hover:text-primary disabled:opacity-35"
                              >
                                <Plus className="size-3.5" aria-hidden />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Peringatan Validasi Sisa Stok */}
                      {atMaxStock && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-warning">
                          <AlertCircle className="size-3 shrink-0" aria-hidden />
                          <span>Maksimal stok tersedia tercapai ({maxStock} porsi).</span>
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Catatan Umum Pesanan (PRD 5.4) */}
                <div className="rounded-2xl border border-border bg-secondary-bg/40 p-3.5">
                  <button
                    type="button"
                    onClick={() => setShowOrderNotes((v) => !v)}
                    className="flex w-full items-center justify-between text-left text-xs font-bold text-foreground"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="size-3.5 text-primary" aria-hidden />
                      <span>Catatan Umum Pesanan</span>
                      {orderNotes.trim() && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Terisi
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] font-semibold text-primary">
                      {showOrderNotes ? "Tutup" : orderNotes.trim() ? "Ubah" : "+ Tambah"}
                    </span>
                  </button>

                  {!showOrderNotes && orderNotes.trim() && (
                    <p className="mt-1.5 truncate text-xs italic text-muted-foreground">
                      &ldquo;{orderNotes}&rdquo;
                    </p>
                  )}

                  {showOrderNotes && (
                    <div className="mt-2.5">
                      <textarea
                        rows={2}
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value.slice(0, 255))}
                        placeholder="Contoh: Sajikan bersamaan, minta sendok & tisu tambahan..."
                        className="w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-xs outline-none focus:border-primary"
                      />
                      <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
                        Otomatis diteruskan ke halaman Checkout ({orderNotes.length}/255)
                      </p>
                    </div>
                  )}
                </div>

                {/* Rekomendasi Menu Pendamping (Cross-Sell Interaktif) */}
                {recommendations.length > 0 && (
                  <div className="pt-2">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      <Sparkles className="size-3.5 text-primary" aria-hidden />
                      <span>Pas Ditambahkan ke Pesananmu</span>
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between gap-2.5 rounded-xl border border-border bg-secondary-bg/40 p-2 transition-colors hover:border-primary/30"
                        >
                          <button
                            type="button"
                            onClick={() => setPreviewProduct(rec)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                          >
                            <ProductImage
                              product={rec}
                              className="size-10 shrink-0 rounded-lg"
                              emojiClassName="text-lg"
                              sizes="40px"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-foreground hover:text-primary">
                                {rec.name}
                              </p>
                              <p className="font-mono text-[11px] text-muted-foreground">
                                {formatRupiah(rec.basePrice)} • Sisa {rec.availableQty}
                              </p>
                            </div>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleQuickAddRecommendation(rec)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[11px] font-bold text-primary border border-border shadow-2xs transition-colors hover:bg-primary hover:text-white hover:border-primary"
                            >
                              <Plus className="size-3" aria-hidden />
                              <span>Tambah</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Footer Tagihan & Checkout */}
          {items.length > 0 && (
            <div className="border-t border-border bg-secondary-bg/70 p-5">
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Subtotal ({itemCount} porsi)</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatRupiah(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{taxLabel}</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatRupiah(taxAmount)}
                  </span>
                </div>
                {!storeSettings.isWebOrderingOpen && (
                  <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    Pemesanan web sedang ditutup sementara oleh admin.
                  </p>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-sm font-extrabold text-foreground">
                  <span>Total Tagihan</span>
                  <span className="font-mono text-base text-primary">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>
              </div>

              <Link
                href={checkoutHref}
                onClick={onClose}
                className="mt-4 flex h-12 w-full items-center justify-between rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-hover"
              >
                <span>
                  Lanjut ke Checkout ({effectiveServiceType === "DINE_IN" ? "Dine In" : "Takeaway"})
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono font-extrabold">
                  {formatRupiah(totalAmount)}
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </div>
          )}
        </aside>
      </div>

      {/* Modal Edit Varian Item Keranjang */}
      {editingCartItem && (
        <ProductDetail
          product={editingCartItem.product}
          initialEditItem={{
            cartItemId: editingCartItem.item.id,
            quantity: editingCartItem.item.quantity,
            options: editingCartItem.item.options,
            itemNotes: editingCartItem.item.itemNotes,
          }}
          onClose={() => setEditingCartItem(null)}
        />
      )}

      {/* Modal Preview Produk Rekomendasi */}
      {previewProduct && (
        <ProductDetail
          product={previewProduct}
          onClose={() => setPreviewProduct(null)}
        />
      )}
    </>
  );
}


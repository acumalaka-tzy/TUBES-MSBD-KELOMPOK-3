"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpDown,
  Minus,
  Plus,
  Search,
  SearchX,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { useCart } from "@/context/cart-context";
import { useActiveTable } from "@/lib/active-table";
import type { Category, Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

type Sort = "populer" | "harga-asc" | "harga-desc";

const sortOptions: { value: Sort; label: string }[] = [
  { value: "populer", label: "Urutkan: Terpopuler" },
  { value: "harga-asc", label: "Harga: Terendah ke Tertinggi" },
  { value: "harga-desc", label: "Harga: Tertinggi ke Terendah" },
];

export function MenuCatalog({ categories, products }: { categories: Category[]; products: Product[] }) {
  const params = useSearchParams();
  const slugParam = params.get("kategori");
  const initialCategory = categories.find((c) => c.slug === slugParam)?.id ?? "all";

  const [category, setCategory] = useState<string>(initialCategory);
  const [prevSlug, setPrevSlug] = useState<string | null>(slugParam);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<Sort>("populer");

  if (slugParam !== prevSlug) {
    setPrevSlug(slugParam);
    const matched = categories.find((c) => c.slug === slugParam)?.id;
    if (matched) setCategory(matched);
  }

  // Pencarian instan dengan debounce 300ms (PRD 5.3)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    const list = products.filter(
      (p) =>
        (category === "all" || p.categoryId === category) &&
        (!debounced ||
          p.name.toLowerCase().includes(debounced) ||
          p.description.toLowerCase().includes(debounced) ||
          p.categoryName.toLowerCase().includes(debounced)),
    );
    return [...list].sort((a, b) => {
      if (sort === "harga-asc") return a.basePrice - b.basePrice;
      if (sort === "harga-desc") return b.basePrice - a.basePrice;
      return b.popularity - a.popularity || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [products, category, debounced, sort]);

  const countFor = (id: string) =>
    id === "all" ? products.length : products.filter((p) => p.categoryId === id).length;
  const tabs = [{ id: "all", name: "Semua Menu", emoji: "🍽️" }, ...categories];

  const {
    items,
    itemCount,
    totalAmount,
    updateQuantity,
    openCart,
    loadSampleItems,
    getProductCartQuantity,
    getProductMaxStock,
  } = useCart();
  const table = useActiveTable();
  const checkoutHref = table ? `/checkout?table=${encodeURIComponent(table)}` : "/checkout";

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
      {/* Sidebar kategori & ringkasan keranjang (Desktop - PRD 5.3) */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          <div className="rounded-2xl border border-border bg-white p-3.5 shadow-sm">
            <h2 className="flex items-center gap-2 px-2.5 pb-2.5 pt-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              <UtensilsCrossed className="h-3.5 w-3.5 text-primary" aria-hidden />
              Kategori Menu
            </h2>
            <ul className="space-y-1">
              {tabs.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setCategory(t.id)}
                    aria-pressed={category === t.id}
                    className={cn(
                      "flex h-11 w-full items-center justify-between rounded-xl px-3 text-left text-xs font-bold transition-all",
                      category === t.id
                        ? "bg-primary text-white shadow-2xs"
                        : "text-foreground/80 hover:bg-secondary-bg hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-2 truncate pr-2">
                      <span aria-hidden>{t.emoji}</span>
                      <span className="truncate">{t.name}</span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[11px]",
                        category === t.id ? "bg-white/20 text-white" : "bg-secondary-bg text-muted-foreground",
                      )}
                    >
                      {countFor(t.id)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Mini-Cart Interaktif di Sidebar Desktop (PRD 5.3) */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-foreground">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span>Keranjang</span>
              </h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                {itemCount} porsi
              </span>
            </div>

            {items.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Belum ada menu yang dipilih. Klik tombol <strong>Tambah</strong> pada kartu menu.
                </p>
                <button
                  type="button"
                  onClick={loadSampleItems}
                  className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-border bg-secondary-bg px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-border/60"
                >
                  <Sparkles className="h-3 w-3 text-primary" aria-hidden />
                  <span>Coba Contoh Pesanan</span>
                </button>
              </div>
            ) : (
              <>
                <div className="my-2.5 max-h-52 space-y-2 overflow-y-auto pr-1">
                  {items.map((item) => {
                    const maxStock = getProductMaxStock(item.productId, item.maxStock);
                    const totalQty = getProductCartQuantity(item.productId);
                    const atMax = totalQty >= maxStock;
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/70 bg-secondary-bg/40 p-2 text-xs"
                      >
                        <p className="truncate font-bold text-foreground">{item.name}</p>
                        {item.options.length > 0 && (
                          <p className="truncate text-[10px] text-muted-foreground">
                            {item.options.map((o) => o.optionName).join(", ")}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-primary">
                            {formatRupiah(item.subtotal)}
                          </span>
                          <div className="flex items-center rounded-lg border border-border bg-white">
                            <button
                              type="button"
                              aria-label={`Kurangi ${item.name}`}
                              onClick={() => updateQuantity(item.id, -1)}
                              className="flex size-6 items-center justify-center hover:text-primary"
                            >
                              <Minus className="size-3" aria-hidden />
                            </button>
                            <span className="w-5 text-center font-mono text-[11px] font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={`Tambah ${item.name}`}
                              disabled={atMax}
                              onClick={() => updateQuantity(item.id, 1)}
                              className="flex size-6 items-center justify-center hover:text-primary disabled:opacity-35"
                            >
                              <Plus className="size-3" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border pt-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Total (+PB1)</span>
                    <span className="font-mono text-sm font-black text-foreground">
                      {formatRupiah(totalAmount)}
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      onClick={openCart}
                      className="flex h-9 w-full items-center justify-center rounded-xl border border-border bg-secondary-bg text-xs font-bold text-foreground transition-colors hover:bg-border/60"
                    >
                      Buka Detail &amp; Catatan
                    </button>
                    <Link
                      href={checkoutHref}
                      className="flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-primary text-xs font-bold text-white shadow-2xs transition-colors hover:bg-primary-hover"
                    >
                      <span>Lanjut Checkout</span>
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      <div>
        {/* Pencarian & pengurutan */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari menu (cth: Sanger, Indomie Bangladesh, Nasi Goreng)..."
              aria-label="Cari menu"
              className="h-11 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="relative">
            <ArrowUpDown
              className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Urutkan menu"
              className="h-11 w-full rounded-xl border border-border bg-white pl-9 pr-8 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-auto"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chip kategori (Mobile & Tablet) */}
        <div
          className="-mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:hidden"
          role="tablist"
          aria-label="Kategori menu"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={category === t.id}
              onClick={() => setCategory(t.id)}
              className={cn(
                "h-10 shrink-0 rounded-xl border px-3.5 text-xs font-bold transition-all",
                category === t.id
                  ? "border-primary bg-primary text-white shadow-2xs"
                  : "border-border bg-white text-foreground/80 hover:bg-secondary-bg",
              )}
            >
              <span aria-hidden>{t.emoji}</span> {t.name} ({countFor(t.id)})
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <p aria-live="polite">
            Menampilkan <strong className="font-bold text-foreground">{filtered.length}</strong> menu
          </p>
          {(query || category !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
              className="font-bold text-primary hover:underline"
            >
              Reset Filter
            </button>
          )}
        </div>

        {filtered.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-border bg-white px-6 py-14 text-center shadow-2xs">
            <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-bold text-foreground">Menu tidak ditemukan</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Coba kata kunci lain atau pilih kategori hidangan yang berbeda.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
              className="mt-4 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-white hover:bg-primary-hover"
            >
              Tampilkan Semua Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

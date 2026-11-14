"use client";

import { useMemo, useState } from "react";
import { Check, Plus, SlidersHorizontal, Sparkles } from "lucide-react";
import type { CartItem, CartOption } from "@/context/cart-context";
import { ProductImage } from "@/components/product-image";
import { sampleProducts, type OptionGroup, type Product } from "@/lib/menu-data";
import { cn, formatRupiah } from "@/lib/utils";

type RecFilterTab = "PAIRING" | "COLD_DRINKS" | "MIE_FOOD" | "SNACKS";

const REC_TABS: { id: RecFilterTab; label: string }[] = [
  { id: "PAIRING", label: "Rekomendasi" },
  { id: "COLD_DRINKS", label: "Dingin & Kopi" },
  { id: "MIE_FOOD", label: "Mie Aceh & Makanan" },
  { id: "SNACKS", label: "Roti & Camilan" },
];

function resolveGroupSelections(
  product: Product,
  override?: Record<string, string[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const g of product.options) {
    const existing = override?.[g.id];
    if (existing && (g.type === "multi" || existing.length > 0)) {
      result[g.id] = existing;
    } else if (g.type === "single" && g.required && g.items[0]) {
      result[g.id] = [g.items[0].id];
    } else {
      result[g.id] = [];
    }
  }
  return result;
}

function buildCartOptions(
  product: Product,
  groupMap: Record<string, string[]>,
): CartOption[] {
  return product.options.flatMap((g) =>
    g.items
      .filter((item) => groupMap[g.id]?.includes(item.id))
      .map((item) => ({
        groupName: g.name,
        optionName: item.name,
        priceAdjustment: item.price,
      })),
  );
}

function formatCompactDelta(price: number): string {
  if (price <= 0) return "";
  if (price >= 1000 && price % 1000 === 0) return `+${price / 1000}rb`;
  return `+${formatRupiah(price)}`;
}

/**
 * Panel rekomendasi interaktif di dalam CartDrawer.
 * Konsumen bisa memilih langsung varian penyajian (Panas/Dingin, Mie Aceh Becek/Goreng/Kuah,
 * level pedas, dan topping) atau berpindah kategori makanan/minuman sebelum klik Tambah.
 */
export function CartRecommendations({
  items,
  isCartEmpty,
  onQuickAdd,
  onOpenDetail,
  getProductCartQuantity,
  getProductMaxStock,
}: {
  items: CartItem[];
  isCartEmpty: boolean;
  onQuickAdd: (product: Product, options: CartOption[]) => { added: number; cappedByStock: boolean };
  onOpenDetail: (product: Product, presetOptions: CartOption[]) => void;
  getProductCartQuantity: (productId: string) => number;
  getProductMaxStock: (productId: string, fallbackMaxStock?: number) => number;
}) {
  const [activeTab, setActiveTab] = useState<RecFilterTab>("PAIRING");
  const [selections, setSelections] = useState<Record<string, Record<string, string[]>>>({});
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const visibleProducts = useMemo(() => {
    const inCartIds = new Set(items.map((i) => i.productId));
    const available = sampleProducts.filter((p) => p.availableQty > 0);

    if (activeTab === "COLD_DRINKS") {
      return available
        .filter((p) => p.categoryId === "cat-dingin-02" || p.categoryId === "cat-kopi-01")
        .sort((a, b) => {
          const aColdBonus = a.categoryId === "cat-dingin-02" ? 10 : 0;
          const bColdBonus = b.categoryId === "cat-dingin-02" ? 10 : 0;
          return b.popularity + bColdBonus - (a.popularity + aColdBonus);
        });
    }

    if (activeTab === "MIE_FOOD") {
      return available
        .filter((p) => p.categoryId === "cat-mie-03")
        .sort((a, b) => {
          const aMieBonus = a.id === "prd-mieaceh-11" ? 20 : 0;
          const bMieBonus = b.id === "prd-mieaceh-11" ? 20 : 0;
          return b.popularity + bMieBonus - (a.popularity + aMieBonus);
        });
    }

    if (activeTab === "SNACKS") {
      return available
        .filter((p) => p.categoryId === "cat-camilan-04")
        .sort((a, b) => b.popularity - a.popularity);
    }

    // Mode PAIRING: utamakan item pelengkap yang belum ada di keranjang (minuman <-> makanan)
    const hasDrink = items.some((i) => {
      const match = sampleProducts.find((p) => p.id === i.productId);
      return match?.categoryId === "cat-kopi-01" || match?.categoryId === "cat-dingin-02";
    });
    const hasFood = items.some((i) => {
      const match = sampleProducts.find((p) => p.id === i.productId);
      return match?.categoryId === "cat-mie-03" || match?.categoryId === "cat-camilan-04";
    });

    const pool = available.filter((p) => !inCartIds.has(p.id));
    const source = pool.length > 0 ? pool : available;

    return [...source]
      .sort((a, b) => {
        const aIsFood = a.categoryId === "cat-mie-03" || a.categoryId === "cat-camilan-04";
        const bIsFood = b.categoryId === "cat-mie-03" || b.categoryId === "cat-camilan-04";
        const aBoost =
          hasDrink && !hasFood && aIsFood ? 200 : !hasDrink && hasFood && !aIsFood ? 200 : 0;
        const bBoost =
          hasDrink && !hasFood && bIsFood ? 200 : !hasDrink && hasFood && !bIsFood ? 200 : 0;
        return b.popularity + bBoost - (a.popularity + aBoost);
      })
      .slice(0, 4);
  }, [activeTab, items]);

  function toggleOption(product: Product, group: OptionGroup, itemId: string) {
    setSelections((prev) => {
      const currentProductMap = resolveGroupSelections(product, prev[product.id]);
      const currentList = currentProductMap[group.id] ?? [];
      const nextList =
        group.type === "single"
          ? [itemId]
          : currentList.includes(itemId)
            ? currentList.filter((id) => id !== itemId)
            : [...currentList, itemId];

      return {
        ...prev,
        [product.id]: {
          ...currentProductMap,
          [group.id]: nextList,
        },
      };
    });
  }

  function setAllDrinksCold() {
    setSelections((prev) => {
      const next = { ...prev };
      for (const product of visibleProducts) {
        const suhuGroup = product.options.find((g) => g.id === "og-suhu");
        const coldItem = suhuGroup?.items.find((i) => /dingin/i.test(i.name));
        if (suhuGroup && coldItem) {
          const currentMap = resolveGroupSelections(product, next[product.id]);
          next[product.id] = {
            ...currentMap,
            [suhuGroup.id]: [coldItem.id],
          };
        }
      }
      return next;
    });
  }

  function handleAdd(product: Product, chosenOptions: CartOption[]) {
    const res = onQuickAdd(product, chosenOptions);
    if (res.added > 0) {
      const variantLabel = chosenOptions.map((o) => o.optionName).join(", ");
      setAddedNotice(
        variantLabel ? `${product.name} (${variantLabel}) ditambahkan` : `${product.name} ditambahkan`,
      );
      setTimeout(() => setAddedNotice(null), 2600);
    }
  }

  const hasHotColdToggleableDrink =
    activeTab === "COLD_DRINKS" &&
    visibleProducts.some((p) => p.options.some((g) => g.id === "og-suhu"));

  return (
    <div className={cn("text-left", isCartEmpty ? "mt-7 w-full border-t border-border pt-5" : "pt-2")}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          <span>
            {isCartEmpty ? "Pilih Menu & Varian Langsung" : "Pas Ditambahkan · Pilih Varian"}
          </span>
        </p>
        {hasHotColdToggleableDrink && (
          <button
            type="button"
            onClick={setAllDrinksCold}
            className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 transition-colors hover:bg-sky-100 cursor-pointer"
          >
            Semua Dingin (Es)
          </button>
        )}
      </div>

      {/* Tab Kategori Cepat Rekomendasi */}
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Kategori rekomendasi keranjang">
        {REC_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer",
              activeTab === tab.id
                ? "border-primary bg-primary text-white shadow-2xs"
                : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {addedNotice && (
        <div
          role="status"
          className="mb-2.5 flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800"
        >
          <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
          <span className="truncate">{addedNotice}</span>
        </div>
      )}

      <div className="space-y-2.5">
        {visibleProducts.map((rec) => {
          const groupMap = resolveGroupSelections(rec, selections[rec.id]);
          const chosenOptions = buildCartOptions(rec, groupMap);
          const extraPrice = chosenOptions.reduce((sum, opt) => sum + opt.priceAdjustment, 0);
          const effectivePrice = rec.basePrice + extraPrice;
          const inCartQty = getProductCartQuantity(rec.id);
          const maxStock = getProductMaxStock(rec.id, rec.availableQty);
          const atMaxStock = inCartQty >= maxStock;

          return (
            <div
              key={rec.id}
              className="rounded-2xl border border-border bg-secondary-bg/45 p-3 transition-colors hover:border-primary/35"
            >
              {/* Header Kartu Rekomendasi */}
              <div className="flex items-start justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenDetail(rec, chosenOptions)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                >
                  <ProductImage
                    product={rec}
                    className="size-12 shrink-0 rounded-xl border border-border"
                    emojiClassName="text-xl"
                    sizes="48px"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-extrabold text-foreground hover:text-primary">
                        {rec.name}
                      </p>
                      {inCartQty > 0 && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                          {inCartQty} di keranjang
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs font-extrabold text-primary">
                      {formatRupiah(effectivePrice)}
                      <span className="ml-1.5 font-sans text-[10px] font-medium text-muted-foreground">
                        • Sisa {maxStock}
                      </span>
                    </p>
                  </div>
                </button>
              </div>

              {/* Pemilih Varian Inline (Panas/Dingin, Mie Becek/Goreng/Kuah, Level Pedas, Topping) */}
              {rec.options.length > 0 && (
                <div className="mt-2.5 space-y-2 border-t border-border/70 pt-2">
                  {rec.options.map((group) => (
                    <div key={group.id}>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {group.name}
                        {group.type === "multi" && (
                          <span className="ml-1 font-normal normal-case">(Opsional)</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map((opt) => {
                          const isSelected = groupMap[group.id]?.includes(opt.id) ?? false;
                          const deltaText = formatCompactDelta(opt.price);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggleOption(rec, group, opt.id)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                                isSelected
                                  ? "border-primary bg-primary text-white shadow-2xs"
                                  : "border-border bg-white text-foreground hover:border-primary/45 hover:text-primary",
                              )}
                            >
                              {group.type === "multi" && (
                                <span className="text-[10px]">{isSelected ? "✓" : "+"}</span>
                              )}
                              <span>{opt.name}</span>
                              {deltaText && (
                                <span
                                  className={cn(
                                    "font-mono text-[10px]",
                                    isSelected ? "text-white/90" : "text-primary font-bold",
                                  )}
                                >
                                  {deltaText}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Aksi Kartu: Catatan/Detail & Tambah Langsung Sesuai Varian */}
              <div className="mt-2.5 flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenDetail(rec, chosenOptions)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground cursor-pointer"
                >
                  <SlidersHorizontal className="size-3 text-primary" aria-hidden />
                  <span>Catatan / Detail</span>
                </button>

                <button
                  type="button"
                  disabled={atMaxStock}
                  onClick={() => handleAdd(rec, chosenOptions)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-[11px] font-bold text-white shadow-2xs transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                >
                  <Plus className="size-3.5" aria-hidden />
                  <span>
                    {atMaxStock ? "Stok Penuh" : `Tambah · ${formatRupiah(effectivePrice)}`}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

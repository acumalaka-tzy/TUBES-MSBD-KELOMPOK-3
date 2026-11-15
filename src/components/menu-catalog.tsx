"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpDown, Search, SearchX, UtensilsCrossed } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type { Category, Product } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

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

  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<Sort>("populer");

  const isManualScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  // Pencarian instan dengan debounce 300ms (PRD 5.3)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Filter hanya berdasarkan query pencarian dan sorting, tidak memfilter kategori agar semua seksi tetap tampil vertikal
  const filtered = useMemo(() => {
    const list = products.filter(
      (p) =>
        !debounced ||
        p.name.toLowerCase().includes(debounced) ||
        p.description.toLowerCase().includes(debounced) ||
        p.categoryName.toLowerCase().includes(debounced),
    );
    return [...list].sort((a, b) => {
      if (sort === "harga-asc") return a.basePrice - b.basePrice;
      if (sort === "harga-desc") return b.basePrice - a.basePrice;
      return b.popularity - a.popularity || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [products, debounced, sort]);

  // Kelompokkan produk berdasarkan jenis/kategori (seperti pada GrabFood / GoFood)
  const groupedSections = useMemo(() => {
    const sections = categories
      .map((cat) => {
        const catProducts = filtered.filter((p) => p.categoryId === cat.id);
        return {
          category: cat,
          products: catProducts,
        };
      })
      .filter((group) => group.products.length > 0);

    // Tangani produk yang mungkin belum memiliki kategori terdaftar
    const knownCatIds = new Set(categories.map((c) => c.id));
    const otherProducts = filtered.filter((p) => !knownCatIds.has(p.categoryId));
    if (otherProducts.length > 0) {
      sections.push({
        category: {
          id: "other",
          name: "Menu Lainnya",
          slug: "menu-lainnya",
          emoji: "✨",
          description: "Pilihan menu spesial lainnya",
        },
        products: otherProducts,
      });
    }

    return sections;
  }, [categories, filtered]);

  const countFor = (id: string) =>
    id === "all" ? products.length : products.filter((p) => p.categoryId === id).length;
  const tabs = [{ id: "all", name: "Semua Menu", emoji: "🍽️" }, ...categories];

  // Navigasi Smooth Scroll presisi ke seksi kategori yang dipilih
  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    isManualScrolling.current = true;

    // Offset mempertimbangkan navbar sticky (64px) + mobile sticky category bar (~54px)
    const yOffset = -124;

    if (catId === "all") {
      const topContainer = document.getElementById("katalog-menu-container");
      if (topContainer) {
        const y = topContainer.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      const targetElement = document.getElementById(`kategori-${catId}`);
      if (targetElement) {
        const y = targetElement.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }
    }

    // Kunci scrollspy sementara selama animasi bergulir (~800ms) agar tidak saling tabrakan
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isManualScrolling.current = false;
    }, 800);
  };

  // Scrollspy: deteksi kategori mana yang sedang aktif saat halaman digeser/di-scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isManualScrolling.current) return;

      const sectionItems = groupedSections
        .map((s) => ({
          id: s.category.id,
          el: document.getElementById(`kategori-${s.category.id}`),
        }))
        .filter((item): item is { id: string; el: HTMLElement } => item.el !== null);

      if (sectionItems.length === 0) return;

      const scrollPosition = window.scrollY + 140; // Offset toleransi sticky navbar + category bar

      // Jika posisi scroll masih di atas seksi kategori pertama, tandai "Semua Menu"
      const firstSectionTop = sectionItems[0].el.offsetTop;
      if (scrollPosition < firstSectionTop + 30) {
        setActiveCategory("all");
        return;
      }

      // Cari seksi kategori yang posisinya paling mendekati scroll saat ini
      let currentId = sectionItems[0].id;
      for (const item of sectionItems) {
        if (item.el.offsetTop <= scrollPosition) {
          currentId = item.id;
        } else {
          break;
        }
      }

      // Jika sudah mentok di paling bawah halaman, aktifkan seksi terakhir
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
        currentId = sectionItems[sectionItems.length - 1].id;
      }

      setActiveCategory(currentId);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [groupedSections]);

  // Geser HANYA container chip horisontal di mobile agar chip aktif selalu terlihat di tengah,
  // TANPA memicu scrollIntoView yang dapat mengganggu scroll vertikal layar
  useEffect(() => {
    if (!tabListRef.current) return;
    const activeChip = document.getElementById(`tab-chip-${activeCategory}`);
    if (activeChip && tabListRef.current) {
      const container = tabListRef.current;
      const chipLeft = activeChip.offsetLeft;
      const chipWidth = activeChip.offsetWidth;
      const containerWidth = container.offsetWidth;
      const scrollTarget = chipLeft - containerWidth / 2 + chipWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollTarget), behavior: "smooth" });
    }
  }, [activeCategory]);

  // Smooth scroll saat awal halaman dimuat jika ada slugParam
  useEffect(() => {
    if (slugParam) {
      const matched = categories.find((c) => c.slug === slugParam);
      if (matched) {
        const timer = setTimeout(() => {
          scrollToCategory(matched.id);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  return (
    <div id="katalog-menu-container" className="scroll-mt-28 lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
      {/* Sidebar kategori (Desktop) */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <div className="rounded-2xl border border-border bg-white p-3.5 shadow-sm">
            <h2 className="flex items-center gap-2 px-2.5 pb-2.5 pt-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              <UtensilsCrossed className="h-3.5 w-3.5 text-primary" aria-hidden />
              Kategori Menu
            </h2>
            <ul className="space-y-1">
              {tabs.map((t) => {
                const isActive = activeCategory === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => scrollToCategory(t.id)}
                      aria-pressed={isActive}
                      className={cn(
                        "flex h-11 w-full items-center justify-between rounded-xl px-3 text-left text-xs font-bold transition-all",
                        isActive
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
                          isActive ? "bg-white/20 text-white" : "bg-secondary-bg text-muted-foreground",
                        )}
                      >
                        {countFor(t.id)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
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

        {/* Chip kategori Sticky di Mobile (menempel di bawah navbar h-16 = top-16 seperti konsep navbar) */}
        <div className="sticky top-16 z-30 -mx-4 mt-3 border-y border-border/70 bg-background/95 px-4 py-2.5 backdrop-blur-md shadow-2xs sm:mx-0 sm:px-0 lg:hidden">
          <div
            ref={tabListRef}
            className="flex gap-2 overflow-x-auto scroll-smooth py-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Kategori menu"
          >
            {tabs.map((t) => {
              const isActive = activeCategory === t.id;
              return (
                <button
                  key={t.id}
                  id={`tab-chip-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => scrollToCategory(t.id)}
                  className={cn(
                    "h-9 shrink-0 rounded-xl border px-3 text-xs font-bold transition-all",
                    isActive
                      ? "border-primary bg-primary text-white shadow-2xs"
                      : "border-border bg-white text-foreground/80 hover:bg-secondary-bg",
                  )}
                >
                  <span aria-hidden>{t.emoji}</span> {t.name}
                  <span
                    className={cn(
                      "ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                      isActive ? "bg-white/20 text-white" : "bg-secondary-bg text-muted-foreground",
                    )}
                  >
                    {countFor(t.id)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <p aria-live="polite">
            Menampilkan <strong className="font-bold text-foreground">{filtered.length}</strong> menu
          </p>
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                scrollToCategory("all");
              }}
              className="font-bold text-primary hover:underline"
            >
              Reset Pencarian
            </button>
          )}
        </div>

        {filtered.length > 0 ? (
          <div className="mt-4 space-y-8">
            {groupedSections.map(({ category: cat, products: catProducts }) => (
              <section
                key={cat.id}
                id={`kategori-${cat.id}`}
                className="space-y-3.5 scroll-mt-32 sm:scroll-mt-28"
              >
                {/* Heading Jenis/Kategori (seperti PROMO PERSONAL! pada referensi) */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    {cat.emoji && (
                      <span className="shrink-0 text-lg sm:text-xl" aria-hidden>
                        {cat.emoji}
                      </span>
                    )}
                    <h2 className="truncate text-base sm:text-lg font-black tracking-tight text-foreground uppercase">
                      {cat.name}
                    </h2>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] font-bold text-muted-foreground bg-secondary-bg px-2.5 py-0.5 rounded-full border border-border/50">
                    {catProducts.length} menu
                  </span>
                </div>

                {/* Daftar kartu menu di bawah jenisnya: 1 card per baris di mobile */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
                  {catProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-border bg-white px-6 py-14 text-center shadow-2xs">
            <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-bold text-foreground">Menu tidak ditemukan</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Coba kata kunci lain untuk mencari hidangan yang diinginkan.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                scrollToCategory("all");
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

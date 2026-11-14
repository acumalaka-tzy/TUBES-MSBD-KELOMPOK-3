"use client";

import React, { useMemo, useState } from "react";
import {
  Archive,
  Edit3,
  FolderPlus,
  Layers,
  Plus,
  RotateCcw,
  Search,
  UtensilsCrossed,
} from "lucide-react";
import {
  restoreCategoryAction,
  restoreProductAction,
  softDeleteCategoryAction,
  softDeleteProductAction,
  toggleProductAvailabilityAction,
  upsertCategoryAction,
} from "@/app/actions/admin";
import { ProductImage } from "@/components/product-image";
import { formatRupiah } from "@/lib/utils";
import type { AdminCategory, AdminProduct } from "@/lib/admin/types";
import { ModalFrame } from "./admin-ui";
import { AdminProductModal } from "./AdminProductModal";

interface AdminCatalogTabProps {
  categories: AdminCategory[];
  products: AdminProduct[];
  onNotify: (type: "success" | "error", text: string) => void;
  onRefresh: () => void;
}

export function AdminCatalogTab({
  categories,
  products,
  onNotify,
  onRefresh,
}: AdminCatalogTabProps) {
  const [showArchivedCats, setShowArchivedCats] = useState(false);
  const [showArchivedProducts, setShowArchivedProducts] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState("ALL");
  const [search, setSearch] = useState("");

  // Modal kategori
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AdminCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catSort, setCatSort] = useState("0");
  const [catActive, setCatActive] = useState(true);
  const [savingCat, setSavingCat] = useState(false);

  // Modal produk
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);

  // Modal soft delete
  const [archiveTarget, setArchiveTarget] = useState<{
    kind: "category" | "product";
    id: string;
    name: string;
  } | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiving, setArchiving] = useState(false);

  const visibleCategories = useMemo(
    () =>
      categories.filter((c) => (showArchivedCats ? true : c.deletedAt === null)),
    [categories, showArchivedCats],
  );

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!showArchivedProducts && p.deletedAt !== null) return false;
      if (selectedCatId !== "ALL" && p.categoryId !== selectedCatId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
      );
    });
  }, [products, showArchivedProducts, selectedCatId, search]);

  function openNewCategory() {
    setEditingCat(null);
    setCatName("");
    setCatSlug("");
    setCatDesc("");
    setCatSort(String(categories.length + 1));
    setCatActive(true);
    setCatModalOpen(true);
  }

  function openEditCategory(cat: AdminCategory) {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatDesc(cat.description ?? "");
    setCatSort(String(cat.sortOrder));
    setCatActive(cat.isActive);
    setCatModalOpen(true);
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setSavingCat(true);
    const res = await upsertCategoryAction({
      id: editingCat?.id,
      name: catName,
      slug: catSlug.trim() || undefined,
      description: catDesc.trim() || undefined,
      sortOrder: Number(catSort) || 0,
      isActive: catActive,
    });
    setSavingCat(false);
    if (!res.success) {
      onNotify("error", res.error ?? "Gagal menyimpan kategori.");
      return;
    }
    setCatModalOpen(false);
    onNotify("success", res.message ?? "Kategori disimpan.");
    onRefresh();
  }

  async function handleConfirmSoftDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!archiveTarget) return;
    setArchiving(true);
    const res =
      archiveTarget.kind === "category"
        ? await softDeleteCategoryAction(archiveTarget.id, archiveReason)
        : await softDeleteProductAction(archiveTarget.id, archiveReason);
    setArchiving(false);
    if (!res.success) {
      onNotify("error", res.error ?? "Gagal mengarsipkan data.");
      return;
    }
    setArchiveTarget(null);
    setArchiveReason("");
    onNotify("success", res.message ?? "Data berhasil diarsipkan (Soft Delete).");
    onRefresh();
  }

  async function handleRestoreCategory(id: string) {
    const res = await restoreCategoryAction(id);
    onNotify(res.success ? "success" : "error", res.message ?? res.error ?? "");
    if (res.success) onRefresh();
  }

  async function handleRestoreProduct(id: string) {
    const res = await restoreProductAction(id);
    onNotify(res.success ? "success" : "error", res.message ?? res.error ?? "");
    if (res.success) onRefresh();
  }

  async function handleToggleAvailability(p: AdminProduct) {
    const res = await toggleProductAvailabilityAction(p.id, !p.isAvailable);
    onNotify(res.success ? "success" : "error", res.message ?? res.error ?? "");
    if (res.success) onRefresh();
  }

  return (
    <div className="space-y-6">
      {/* Bagian Kategori */}
      <section className="rounded-2xl border border-border bg-background p-4 shadow-xs">
        <div className="flex flex-col justify-between gap-3 border-b border-border pb-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Layers className="h-4 w-4 text-primary" />
              Kategori Menu ({visibleCategories.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Gunakan Soft Delete agar histori laporan penjualan lama tetap aman saat kategori dihapus
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showArchivedCats}
                onChange={(e) => setShowArchivedCats(e.target.checked)}
                className="accent-primary"
              />
              Tampilkan Arsip
            </label>
            <button
              type="button"
              onClick={openNewCategory}
              className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-bg px-3 py-2 text-xs font-bold text-foreground hover:bg-border/60"
            >
              <FolderPlus className="h-3.5 w-3.5 text-primary" />
              Tambah Kategori
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleCategories.map((cat) => {
            const isArchived = cat.deletedAt !== null;
            return (
              <div
                key={cat.id}
                className={`flex flex-col justify-between rounded-xl border p-3 ${
                  isArchived
                    ? "border-dashed border-border bg-secondary-bg/40 opacity-75"
                    : "border-border bg-background"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-foreground">{cat.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isArchived
                          ? "bg-error/10 text-error"
                          : cat.isActive
                            ? "bg-success/10 text-success"
                            : "bg-secondary-bg text-muted-foreground"
                      }`}
                    >
                      {isArchived ? "Diarsipkan" : cat.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    /{cat.slug} · {cat.productCount} menu
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/60 pt-2">
                  {isArchived ? (
                    <button
                      type="button"
                      onClick={() => handleRestoreCategory(cat.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-success hover:bg-success/10"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Pulihkan
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditCategory(cat)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary-bg"
                      >
                        <Edit3 className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setArchiveTarget({
                            kind: "category",
                            id: cat.id,
                            name: cat.name,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-error hover:bg-error/10"
                      >
                        <Archive className="h-3 w-3" />
                        Arsipkan
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bagian Menu & Varian */}
      <section className="space-y-4 rounded-2xl border border-border bg-background p-4 shadow-xs">
        <div className="flex flex-col justify-between gap-3 border-b border-border pb-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              Daftar Menu &amp; Varian ({visibleProducts.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Unggah foto makanan, kelola harga, opsi varian, dan status ketersediaan menu
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              aria-label="Filter kategori menu"
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
            >
              <option value="ALL">Semua Kategori</option>
              {categories
                .filter((c) => c.deletedAt === null)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari menu..."
                className="rounded-xl border border-border bg-background py-2 pr-3 pl-8 text-xs text-foreground"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-1.5 px-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showArchivedProducts}
                onChange={(e) => setShowArchivedProducts(e.target.checked)}
                className="accent-primary"
              />
              Arsip
            </label>

            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setProductModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-primary-hover"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Menu
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary-bg text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Menu</th>
                <th className="px-3 py-2.5">Kategori</th>
                <th className="px-3 py-2.5 text-right">Harga Dasar</th>
                <th className="px-3 py-2.5">Varian</th>
                <th className="px-3 py-2.5 text-right">Stok</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Belum ada menu sesuai filter ini.
                  </td>
                </tr>
              ) : (
                visibleProducts.map((p) => {
                  const isArchived = p.deletedAt !== null;
                  return (
                    <tr key={p.id} className="hover:bg-secondary-bg/40">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            product={{
                              id: p.id,
                              name: p.name,
                              emoji: "🍽️",
                              imageUrl: p.imageUrl ?? undefined,
                            }}
                            className="size-11 shrink-0 rounded-xl border border-border"
                            emojiClassName="text-lg"
                            sizes="44px"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{p.name}</p>
                            <p className="max-w-xs truncate text-[11px] text-muted-foreground">
                              {p.description || "Tanpa deskripsi"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                        {p.categoryName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-bold text-foreground">
                        {formatRupiah(p.basePrice)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                        {p.optionGroups.length > 0
                          ? `${p.optionGroups.length} grup`
                          : "Standar"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold text-foreground">
                        {p.availableQty}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {isArchived ? (
                          <span className="rounded-full bg-error/10 px-2.5 py-0.5 text-[10px] font-bold text-error">
                            Diarsipkan
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(p)}
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors ${
                              p.isAvailable
                                ? "bg-success/10 text-success hover:bg-success/20"
                                : "bg-secondary-bg text-muted-foreground hover:bg-border/60"
                            }`}
                          >
                            {p.isAvailable ? "Tersedia" : "Nonaktif"}
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isArchived ? (
                            <button
                              type="button"
                              onClick={() => handleRestoreProduct(p.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-success/40 px-2.5 py-1 text-[11px] font-semibold text-success hover:bg-success/10"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Pulihkan
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProduct(p);
                                  setProductModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary-bg"
                              >
                                <Edit3 className="h-3 w-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setArchiveTarget({
                                    kind: "product",
                                    id: p.id,
                                    name: p.name,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-error/30 px-2.5 py-1 text-[11px] font-semibold text-error hover:bg-error/10"
                              >
                                <Archive className="h-3 w-3" />
                                Soft Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Kategori */}
      {catModalOpen && (
        <ModalFrame
          title={editingCat ? `Edit Kategori · ${editingCat.name}` : "Tambah Kategori Baru"}
          onClose={() => setCatModalOpen(false)}
        >
          <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-foreground">Nama Kategori</label>
              <input
                type="text"
                required
                minLength={2}
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-foreground">Slug URL (Opsional)</label>
                <input
                  type="text"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  placeholder="otomatis-dari-nama"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-foreground"
                />
              </div>
              <div>
                <label className="block font-semibold text-foreground">Urutan</label>
                <input
                  type="number"
                  min={0}
                  value={catSort}
                  onChange={(e) => setCatSort(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-foreground">Deskripsi (Opsional)</label>
              <textarea
                rows={2}
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 font-semibold text-foreground">
              <input
                type="checkbox"
                checked={catActive}
                onChange={(e) => setCatActive(e.target.checked)}
                className="accent-primary"
              />
              Kategori aktif di katalog
            </label>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 font-semibold text-foreground hover:bg-secondary-bg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingCat}
                className="rounded-xl bg-primary px-4 py-2 font-bold text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {savingCat ? "Menyimpan..." : "Simpan Kategori"}
              </button>
            </div>
          </form>
        </ModalFrame>
      )}

      {/* Modal Produk & Varian */}
      {productModalOpen && (
        <AdminProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => setProductModalOpen(false)}
          onNotify={onNotify}
          onSaved={() => {
            setProductModalOpen(false);
            onRefresh();
          }}
        />
      )}

      {/* Modal Konfirmasi Soft Delete */}
      {archiveTarget && (
        <ModalFrame
          title={`Arsipkan (Soft Delete) · ${archiveTarget.name}`}
          subtitle="Data ditandai deleted_at tanpa menghapus histori penjualan lama"
          onClose={() => setArchiveTarget(null)}
        >
          <form onSubmit={handleConfirmSoftDelete} className="space-y-4 text-xs">
            <p className="leading-relaxed text-muted-foreground">
              Item ini akan disembunyikan dari menu pelanggan, namun tetap dapat dipulihkan
              kapan saja melalui filter Arsip dan seluruh laporan transaksi terdahulu tetap utuh.
            </p>
            <div>
              <label className="block font-semibold text-foreground">
                Alasan Pengarsipan (Opsional)
              </label>
              <input
                type="text"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="Contoh: Menu musiman / sedang tidak diproduksi"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="rounded-xl border border-border px-4 py-2 font-semibold text-foreground hover:bg-secondary-bg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={archiving}
                className="rounded-xl bg-error px-4 py-2 font-bold text-white hover:bg-error/90 disabled:opacity-60"
              >
                {archiving ? "Mengarsipkan..." : "Konfirmasi Soft Delete"}
              </button>
            </div>
          </form>
        </ModalFrame>
      )}
    </div>
  );
}

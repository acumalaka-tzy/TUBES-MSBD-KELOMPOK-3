"use client";

import React, { useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { saveProductAction } from "@/app/actions/admin";
import { ProductImage } from "@/components/product-image";
import type { AdminCategory, AdminProduct } from "@/lib/admin/types";
import { ModalFrame } from "./admin-ui";

interface AdminProductModalProps {
  product: AdminProduct | null;
  categories: AdminCategory[];
  onClose: () => void;
  onNotify: (type: "success" | "error", text: string) => void;
  onSaved: () => void;
}

interface DraftOptionItem {
  id?: string;
  name: string;
  priceAdjustment: string;
  isAvailable: boolean;
}

interface DraftOptionGroup {
  id?: string;
  name: string;
  isRequired: boolean;
  isMulti: boolean;
  items: DraftOptionItem[];
}

export function AdminProductModal({
  product,
  categories,
  onClose,
  onNotify,
  onSaved,
}: AdminProductModalProps) {
  const activeCategories = categories.filter((c) => c.deletedAt === null);

  const [categoryId, setCategoryId] = useState(
    product?.categoryId ?? activeCategories[0]?.id ?? "",
  );
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [basePrice, setBasePrice] = useState(
    product ? String(product.basePrice) : "15000",
  );
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable ?? true);
  const [sortOrder, setSortOrder] = useState(
    product ? String(product.sortOrder) : "1",
  );
  const [initialQty, setInitialQty] = useState(
    product ? String(product.availableQty) : "20",
  );
  const [minThreshold, setMinThreshold] = useState(
    product ? String(product.minThreshold) : "5",
  );
  const [optionGroups, setOptionGroups] = useState<DraftOptionGroup[]>(() =>
    (product?.optionGroups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      isRequired: g.isRequired,
      isMulti: g.isMulti,
      items: g.items.map((it) => ({
        id: it.id,
        name: it.name,
        priceAdjustment: String(it.priceAdjustment),
        isAvailable: it.isAvailable,
      })),
    })),
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        onNotify("error", data.error ?? "Gagal mengunggah foto makanan.");
        return;
      }
      setImageUrl(data.url);
      onNotify("success", "Foto makanan berhasil diunggah.");
    } catch {
      onNotify("error", "Koneksi terputus saat mengunggah gambar.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function addOptionGroup() {
    setOptionGroups((prev) => [
      ...prev,
      {
        name: "Tingkat Kemanisan / Pedas",
        isRequired: false,
        isMulti: false,
        items: [{ name: "Normal", priceAdjustment: "0", isAvailable: true }],
      },
    ]);
  }

  function updateGroup(idx: number, patch: Partial<DraftOptionGroup>) {
    setOptionGroups((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    );
  }

  function removeGroup(idx: number) {
    setOptionGroups((prev) => prev.filter((_, i) => i !== idx));
  }

  function addOptionItem(gIdx: number) {
    setOptionGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx
          ? {
              ...g,
              items: [
                ...g.items,
                { name: "", priceAdjustment: "0", isAvailable: true },
              ],
            }
          : g,
      ),
    );
  }

  function updateOptionItem(
    gIdx: number,
    iIdx: number,
    patch: Partial<DraftOptionItem>,
  ) {
    setOptionGroups((prev) =>
      prev.map((g, gi) =>
        gi === gIdx
          ? {
              ...g,
              items: g.items.map((it, ii) =>
                ii === iIdx ? { ...it, ...patch } : it,
              ),
            }
          : g,
      ),
    );
  }

  function removeOptionItem(gIdx: number, iIdx: number) {
    setOptionGroups((prev) =>
      prev.map((g, gi) =>
        gi === gIdx
          ? { ...g, items: g.items.filter((_, ii) => ii !== iIdx) }
          : g,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveProductAction({
      id: product?.id,
      categoryId,
      name,
      description,
      basePrice: Number(basePrice),
      imageUrl: imageUrl.trim() || undefined,
      isAvailable,
      sortOrder: Number(sortOrder),
      initialQty: Number(initialQty),
      minThreshold: Number(minThreshold),
      optionGroups: optionGroups.map((g) => ({
        id: g.id,
        name: g.name,
        isRequired: g.isRequired,
        isMulti: g.isMulti,
        items: g.items.map((it) => ({
          id: it.id,
          name: it.name,
          priceAdjustment: Number(it.priceAdjustment) || 0,
          isAvailable: it.isAvailable,
        })),
      })),
    });
    setSaving(false);
    if (!res.success) {
      onNotify("error", res.error ?? "Gagal menyimpan menu.");
      return;
    }
    onNotify("success", res.message ?? "Menu berhasil disimpan.");
    onSaved();
  }

  return (
    <ModalFrame
      title={product ? `Edit Menu · ${product.name}` : "Tambah Menu Baru"}
      subtitle="Lengkapi detail menu, foto makanan, serta grup varian / topping"
      maxWidthClass="max-w-2xl"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        {/* Foto Makanan */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary-bg/40 p-3.5 sm:flex-row sm:items-center">
          <ProductImage
            product={{
              id: product?.id ?? "preview-menu",
              name: name || "Preview Menu",
              emoji: "🍽️",
              imageUrl: imageUrl.trim() || undefined,
            }}
            className="size-20 shrink-0 rounded-xl border border-border"
            emojiClassName="text-2xl"
            sizes="80px"
          />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-semibold text-foreground hover:bg-secondary-bg">
                <Upload className="h-3.5 w-3.5 text-primary" />
                {uploading ? "Mengunggah..." : "Upload Foto (Max 2MB)"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-error hover:bg-error/10"
                >
                  Hapus Foto
                </button>
              )}
            </div>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Atau tempel URL / path gambar (/images/menu/...)"
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] text-foreground"
            />
          </div>
        </div>

        {/* Info Dasar Menu */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block font-semibold text-foreground">Nama Menu</label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
            />
          </div>
          <div>
            <label className="block font-semibold text-foreground">Kategori</label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
            >
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-foreground">Harga Dasar (Rp)</label>
            <input
              type="number"
              min={0}
              required
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
            />
          </div>
          <div>
            <label className="block font-semibold text-foreground">Urutan Tampil</label>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
            />
          </div>

          {!product && (
            <>
              <div>
                <label className="block font-semibold text-foreground">Stok Awal (Porsi)</label>
                <input
                  type="number"
                  min={0}
                  value={initialQty}
                  onChange={(e) => setInitialQty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
                />
              </div>
              <div>
                <label className="block font-semibold text-foreground">Batas Stok Minimum</label>
                <input
                  type="number"
                  min={0}
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <label className="block font-semibold text-foreground">Deskripsi Singkat</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 font-semibold text-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Menu aktif dan tersedia untuk dipesan pelanggan
          </label>
        </div>

        {/* Grup Varian & Opsi */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-foreground">Grup Varian &amp; Topping</h4>
              <p className="text-[11px] text-muted-foreground">
                Tambahkan pilihan suhu, tingkat pedas, atau topping tambahan beserta penyesuaian harga
              </p>
            </div>
            <button
              type="button"
              onClick={addOptionGroup}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-semibold text-foreground hover:bg-secondary-bg"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              Grup Varian
            </button>
          </div>

          {optionGroups.length === 0 ? (
            <p className="rounded-xl bg-secondary-bg/60 p-3 text-center text-[11px] text-muted-foreground">
              Belum ada grup varian untuk menu ini.
            </p>
          ) : (
            <div className="space-y-3">
              {optionGroups.map((grp, gIdx) => (
                <div
                  key={grp.id ?? `grp-${gIdx}`}
                  className="space-y-2.5 rounded-xl border border-border bg-secondary-bg/30 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      type="text"
                      required
                      value={grp.name}
                      onChange={(e) => updateGroup(gIdx, { name: e.target.value })}
                      placeholder="Nama grup (misal: Topping / Level Pedas)"
                      className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 font-semibold text-foreground"
                    />
                    <label className="flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={grp.isRequired}
                        onChange={(e) => updateGroup(gIdx, { isRequired: e.target.checked })}
                      />
                      Wajib
                    </label>
                    <label className="flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={grp.isMulti}
                        onChange={(e) => updateGroup(gIdx, { isMulti: e.target.checked })}
                      />
                      Multi-pilih
                    </label>
                    <button
                      type="button"
                      onClick={() => removeGroup(gIdx)}
                      aria-label="Hapus grup varian"
                      className="rounded-lg p-1 text-error hover:bg-error/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5 pl-2">
                    {grp.items.map((it, iIdx) => (
                      <div key={it.id ?? `it-${iIdx}`} className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          value={it.name}
                          onChange={(e) =>
                            updateOptionItem(gIdx, iIdx, { name: e.target.value })
                          }
                          placeholder="Nama pilihan"
                          className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1 text-foreground"
                        />
                        <input
                          type="number"
                          min={0}
                          value={it.priceAdjustment}
                          onChange={(e) =>
                            updateOptionItem(gIdx, iIdx, { priceAdjustment: e.target.value })
                          }
                          placeholder="+Rp"
                          className="w-24 rounded-lg border border-border bg-background px-2 py-1 font-mono text-foreground"
                        />
                        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={it.isAvailable}
                            onChange={(e) =>
                              updateOptionItem(gIdx, iIdx, { isAvailable: e.target.checked })
                            }
                          />
                          Aktif
                        </label>
                        {grp.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOptionItem(gIdx, iIdx)}
                            aria-label="Hapus pilihan"
                            className="rounded p-1 text-muted-foreground hover:text-error"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOptionItem(gIdx)}
                      className="inline-flex items-center gap-1 pt-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      Tambah Pilihan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 font-semibold text-foreground hover:bg-secondary-bg"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="rounded-xl bg-primary px-5 py-2 font-bold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : product ? "Simpan Perubahan" : "Tambahkan Menu"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

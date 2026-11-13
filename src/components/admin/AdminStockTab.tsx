"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownUp, Boxes, History, Search, SlidersHorizontal } from "lucide-react";
import { adjustStockAction, setDailyStockAction } from "@/app/actions/admin";
import { ProductImage } from "@/components/product-image";
import {
  ADJUSTMENT_REASONS,
  MOVEMENT_LABEL,
  type AdjustmentReason,
  type AdminProduct,
  type AdminStockMovement,
} from "@/lib/admin/types";
import { formatDateTimeId, ModalFrame } from "./admin-ui";

interface AdminStockTabProps {
  products: AdminProduct[];
  movements: AdminStockMovement[];
  onNotify: (type: "success" | "error", text: string) => void;
  onRefresh: () => void;
}

type StockFilter = "ALL" | "LOW" | "OUT";

function computePreviewQty(
  current: number,
  reason: AdjustmentReason,
  qty: number,
): number {
  if (!Number.isFinite(qty) || qty < 0) return current;
  if (reason === "RESTOCK") return current + qty;
  if (reason === "DAMAGED_EXPIRED") return Math.max(0, current - qty);
  return qty;
}

export function AdminStockTab({
  products,
  movements,
  onNotify,
  onRefresh,
}: AdminStockTabProps) {
  const [filter, setFilter] = useState<StockFilter>("ALL");
  const [search, setSearch] = useState("");

  // Modal atur stok harian
  const [dailyTarget, setDailyTarget] = useState<AdminProduct | null>(null);
  const [dailyQty, setDailyQty] = useState("");
  const [minThreshold, setMinThreshold] = useState("");
  const [dailyNote, setDailyNote] = useState("");
  const [savingDaily, setSavingDaily] = useState(false);

  // Modal penyesuaian stok manual
  const [adjustTarget, setAdjustTarget] = useState<AdminProduct | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentReason>("RESTOCK");
  const [adjustQty, setAdjustQty] = useState("5");
  const [reasonNote, setReasonNote] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  const activeProducts = useMemo(
    () => products.filter((p) => p.deletedAt === null),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeProducts.filter((p) => {
      if (filter === "OUT" && p.availableQty > 0) return false;
      if (filter === "LOW" && (p.availableQty <= 0 || p.availableQty > p.minThreshold)) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
      );
    });
  }, [activeProducts, filter, search]);

  const lowCount = activeProducts.filter(
    (p) => p.availableQty > 0 && p.availableQty <= p.minThreshold,
  ).length;
  const outCount = activeProducts.filter((p) => p.availableQty <= 0).length;

  function openDailyModal(p: AdminProduct) {
    setDailyTarget(p);
    setDailyQty(String(p.availableQty));
    setMinThreshold(String(p.minThreshold));
    setDailyNote("");
  }

  function openAdjustModal(p: AdminProduct) {
    setAdjustTarget(p);
    setAdjustmentType("RESTOCK");
    setAdjustQty("5");
    setReasonNote("");
  }

  async function handleSaveDaily(e: React.FormEvent) {
    e.preventDefault();
    if (!dailyTarget) return;
    setSavingDaily(true);
    const res = await setDailyStockAction({
      productId: dailyTarget.id,
      dailyQty: Number(dailyQty),
      minThreshold: Number(minThreshold),
      reasonNote: dailyNote.trim() || undefined,
    });
    setSavingDaily(false);
    if (!res.success) {
      onNotify("error", res.error ?? "Gagal mengatur stok harian.");
      return;
    }
    setDailyTarget(null);
    onNotify("success", res.message ?? "Stok harian diperbarui.");
    onRefresh();
  }

  async function handleSaveAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustTarget) return;
    const numericQty = Number(adjustQty);
    if (adjustmentType === "DAMAGED_EXPIRED" && numericQty > adjustTarget.availableQty) {
      onNotify(
        "error",
        `Jumlah pengurangan (${numericQty}) melebihi stok tersedia (${adjustTarget.availableQty} porsi). Stok tidak boleh negatif.`,
      );
      return;
    }
    setSavingAdjust(true);
    const res = await adjustStockAction({
      productId: adjustTarget.id,
      adjustmentType,
      qty: numericQty,
      reasonNote,
    });
    setSavingAdjust(false);
    if (!res.success) {
      onNotify("error", res.error ?? "Gagal melakukan penyesuaian stok.");
      return;
    }
    setAdjustTarget(null);
    onNotify("success", res.message ?? "Penyesuaian stok tersimpan.");
    onRefresh();
  }

  return (
    <div className="space-y-6">
      {/* Toolbar & Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Boxes className="h-4 w-4 text-primary" />
            Manajemen Stok Porsi Harian
          </h2>
          <p className="text-xs text-muted-foreground">
            Atur kuota porsi harian atau catat mutasi manual (stok masuk, rusak/basi, koreksi opname)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-secondary-bg p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`rounded-lg px-2.5 py-1 font-semibold ${
                filter === "ALL" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              Semua ({activeProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("LOW")}
              className={`rounded-lg px-2.5 py-1 font-semibold ${
                filter === "LOW" ? "bg-background text-amber-700 shadow-xs" : "text-muted-foreground"
              }`}
            >
              Menipis ({lowCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("OUT")}
              className={`rounded-lg px-2.5 py-1 font-semibold ${
                filter === "OUT" ? "bg-background text-error shadow-xs" : "text-muted-foreground"
              }`}
            >
              Habis ({outCount})
            </button>
          </div>

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
        </div>
      </div>

      {/* Tabel Stok Porsi */}
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary-bg text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Menu</th>
                <th className="px-4 py-3 text-right">Tersedia</th>
                <th className="px-4 py-3 text-right">Dipesan (Reserved)</th>
                <th className="px-4 py-3 text-right">Batas Min</th>
                <th className="px-4 py-3 text-right">Terjual</th>
                <th className="px-4 py-3 text-right">Aksi Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Tidak ada menu yang cocok dengan filter stok saat ini.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.availableQty <= 0;
                  const isLow = !isOut && p.availableQty <= p.minThreshold;
                  return (
                    <tr key={p.id} className="hover:bg-secondary-bg/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            product={{
                              id: p.id,
                              name: p.name,
                              emoji: "🍽️",
                              imageUrl: p.imageUrl ?? undefined,
                            }}
                            className="size-10 shrink-0 rounded-lg"
                            emojiClassName="text-base"
                            sizes="40px"
                          />
                          <div>
                            <p className="font-semibold text-foreground">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground">{p.categoryName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] ${
                            isOut
                              ? "bg-error/10 text-error"
                              : isLow
                                ? "bg-warning/15 text-amber-800"
                                : "bg-success/10 text-success"
                          }`}
                        >
                          {(isOut || isLow) && <AlertTriangle className="h-3 w-3" />}
                          {p.availableQty} porsi
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {p.reservedQty}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {p.minThreshold}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                        {p.soldQty}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDailyModal(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-secondary-bg"
                          >
                            <SlidersHorizontal className="h-3 w-3" />
                            Stok Harian
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjustModal(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-hover"
                          >
                            <ArrowDownUp className="h-3 w-3" />
                            Penyesuaian
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Riwayat Mutasi Stok */}
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-xs">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <History className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Riwayat Mutasi Stok Terakhir</h3>
            <p className="text-[11px] text-muted-foreground">
              Menampilkan {movements.length} pergerakan stok (otomatis &amp; penyesuaian manual)
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary-bg text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Waktu</th>
                <th className="px-4 py-2.5">Menu</th>
                <th className="px-4 py-2.5">Jenis Mutasi</th>
                <th className="px-4 py-2.5 text-right">Perubahan</th>
                <th className="px-4 py-2.5 text-right">Stok Sebelum → Sesudah</th>
                <th className="px-4 py-2.5">Alasan</th>
                <th className="px-4 py-2.5">Aktor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Belum ada riwayat mutasi stok. Gunakan tombol &ldquo;Stok Harian&rdquo; atau
                    &ldquo;Penyesuaian&rdquo; untuk mencatat mutasi pertama.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-secondary-bg/40">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {formatDateTimeId(m.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-foreground">{m.productName}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="rounded-full border border-border bg-secondary-bg px-2 py-0.5 text-[10px] font-semibold text-foreground">
                        {MOVEMENT_LABEL[m.movementType]}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-bold ${
                        m.qtyChange >= 0 ? "text-success" : "text-error"
                      }`}
                    >
                      {m.qtyChange >= 0 ? `+${m.qtyChange}` : m.qtyChange}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-muted-foreground">
                      {m.availableBefore} →{" "}
                      <span className="font-bold text-foreground">{m.availableAfter}</span>
                    </td>
                    <td className="max-w-xs px-4 py-2.5 text-muted-foreground">
                      {m.reason || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {m.actorName || "Sistem"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Set Stok Harian */}
      {dailyTarget && (
        <ModalFrame
          title={`Atur Stok Harian · ${dailyTarget.name}`}
          subtitle="Mengatur kuota stok siap jual dan batas peringatan minimum"
          onClose={() => setDailyTarget(null)}
        >
          <form onSubmit={handleSaveDaily} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-foreground">Kuota Porsi Harian</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={dailyQty}
                  onChange={(e) => setDailyQty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
                />
              </div>
              <div>
                <label className="block font-semibold text-foreground">Batas Peringatan Min</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-foreground">Catatan (Opsional)</label>
              <input
                type="text"
                value={dailyNote}
                onChange={(e) => setDailyNote(e.target.value)}
                placeholder="Contoh: Persiapan stok buka pagi"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setDailyTarget(null)}
                className="rounded-xl border border-border px-4 py-2 font-semibold text-foreground hover:bg-secondary-bg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingDaily}
                className="rounded-xl bg-primary px-4 py-2 font-bold text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {savingDaily ? "Menyimpan..." : "Simpan Stok Harian"}
              </button>
            </div>
          </form>
        </ModalFrame>
      )}

      {/* Modal Penyesuaian Stok Manual (Stock Adjustment) */}
      {adjustTarget && (
        <ModalFrame
          title={`Penyesuaian Stok Manual · ${adjustTarget.name}`}
          subtitle="Wajib memilih jenis mutasi dan mengisi alasan yang jelas untuk Audit Log"
          onClose={() => setAdjustTarget(null)}
        >
          <form onSubmit={handleSaveAdjust} className="space-y-4 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-secondary-bg p-3">
              <div>
                <p className="text-muted-foreground">Stok Tersedia Saat Ini</p>
                <p className="font-mono text-lg font-bold text-foreground">
                  {adjustTarget.availableQty} porsi
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Estimasi Stok Baru</p>
                <p className="font-mono text-lg font-bold text-primary">
                  {computePreviewQty(
                    adjustTarget.availableQty,
                    adjustmentType,
                    Number(adjustQty),
                  )}{" "}
                  porsi
                </p>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-foreground">Jenis Alasan Mutasi</label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as AdjustmentReason)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
              >
                {(Object.keys(ADJUSTMENT_REASONS) as AdjustmentReason[]).map((key) => (
                  <option key={key} value={key}>
                    {ADJUSTMENT_REASONS[key].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-foreground">
                {adjustmentType === "RESTOCK"
                  ? "Jumlah Penambahan Porsi (+)"
                  : adjustmentType === "DAMAGED_EXPIRED"
                    ? "Jumlah Pengurangan Porsi (-)"
                    : "Total Stok Akhir Hasil Opname"}
              </label>
              <input
                type="number"
                min={adjustmentType === "OPNAME_CORRECTION" ? 0 : 1}
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground">
                Keterangan Alasan Mutasi <span className="text-error">*</span>
              </label>
              <textarea
                rows={2}
                required
                minLength={3}
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Contoh: Tambah 15 porsi batch sore / 2 porsi kuah tumpah di dapur"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="rounded-xl border border-border px-4 py-2 font-semibold text-foreground hover:bg-secondary-bg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingAdjust}
                className="rounded-xl bg-primary px-4 py-2 font-bold text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {savingAdjust ? "Menyimpan..." : "Terapkan Penyesuaian"}
              </button>
            </div>
          </form>
        </ModalFrame>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { Globe, Lock, Save, Store } from "lucide-react";
import { toggleWebOrderingAction, updateStoreSettingsAction } from "@/app/actions/admin";
import type { AdminSettings } from "@/lib/admin/types";
import { formatDateTimeId } from "./admin-ui";

interface AdminSettingsTabProps {
  key?: React.Key;
  settings: AdminSettings;
  onNotify: (type: "success" | "error", text: string) => void;
  onRefresh: () => void;
}

export function AdminSettingsTab({
  settings,
  onNotify,
  onRefresh,
}: AdminSettingsTabProps) {
  const [toggleReason, setToggleReason] = useState("");
  const [toggling, setToggling] = useState(false);

  const [restaurantName, setRestaurantName] = useState(settings.restaurantName);
  const [address, setAddress] = useState(settings.address);
  const [phoneWhatsapp, setPhoneWhatsapp] = useState(settings.phoneWhatsapp);
  const [openingHours, setOpeningHours] = useState(settings.openingHours);
  const [digitalExpiryMinutes, setDigitalExpiryMinutes] = useState(
    String(settings.digitalExpiryMinutes),
  );
  const [cashExpiryMinutes, setCashExpiryMinutes] = useState(
    String(settings.cashExpiryMinutes),
  );
  const [receiptFooterNote, setReceiptFooterNote] = useState(settings.receiptFooterNote);
  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleMasterToggle() {
    setToggling(true);
    const res = await toggleWebOrderingAction(
      !settings.isWebOrderingOpen,
      toggleReason.trim() || undefined,
    );
    setToggling(false);
    if (!res.success) {
      onNotify("error", res.error ?? "Gagal mengubah status pemesanan web.");
      return;
    }
    setToggleReason("");
    onNotify("success", res.message ?? "Status pemesanan web diperbarui.");
    onRefresh();
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateStoreSettingsAction({
      restaurantName,
      address,
      phoneWhatsapp,
      openingHours,
      isWebOrderingOpen: settings.isWebOrderingOpen,
      digitalExpiryMinutes: Number(digitalExpiryMinutes),
      cashExpiryMinutes: Number(cashExpiryMinutes),
      receiptFooterNote,
      reason: changeReason.trim() || undefined,
    });
    setSaving(false);
    if (!res.success) {
      onNotify("error", res.error ?? "Gagal menyimpan pengaturan toko.");
      return;
    }
    setChangeReason("");
    onNotify("success", res.message ?? "Pengaturan toko berhasil diperbarui.");
    onRefresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Master Toggle Pemesanan Web */}
      <div
        style={{ animationDelay: "30ms" }}
        className="animate-fade-slide-up space-y-4 lg:col-span-5"
      >
        <div
          className={`rounded-2xl border p-5 shadow-xs ${
            settings.isWebOrderingOpen
              ? "border-success/40 bg-success/5"
              : "border-error/40 bg-error/5"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  settings.isWebOrderingOpen
                    ? "bg-success/15 text-success"
                    : "bg-error/15 text-error"
                }`}
              >
                {settings.isWebOrderingOpen ? (
                  <Globe className="h-5 w-5" />
                ) : (
                  <Lock className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Master Toggle Pemesanan Web
                </h2>
                <p className="text-xs text-muted-foreground">
                  {settings.isWebOrderingOpen
                    ? "BUKA · Pelanggan dapat checkout online"
                    : "TUTUP · Checkout web dinonaktifkan sementara"}
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                settings.isWebOrderingOpen
                  ? "bg-success text-white"
                  : "bg-error text-white"
              }`}
            >
              {settings.isWebOrderingOpen ? "BUKA" : "TUTUP"}
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Saat ditutup, halaman keranjang &amp; checkout langsung menampilkan status tutup
            dan menolak order web baru. Setiap perubahan otomatis dicatat di Audit Log.
          </p>

          <div className="mt-4 space-y-2.5">
            <input
              type="text"
              value={toggleReason}
              onChange={(e) => setToggleReason(e.target.value)}
              placeholder="Alasan buka/tutup (opsional, misal: Dapur penuh / Tutup harian)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              disabled={toggling}
              onClick={handleMasterToggle}
              className={`w-full rounded-xl px-4 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-60 ${
                settings.isWebOrderingOpen
                  ? "bg-error hover:bg-error/90"
                  : "bg-success hover:bg-success/90"
              }`}
            >
              {toggling
                ? "Memproses..."
                : settings.isWebOrderingOpen
                  ? "Tutup Pemesanan Web Sekarang"
                  : "Buka Pemesanan Web Sekarang"}
            </button>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Pembaruan terakhir: {formatDateTimeId(settings.updatedAt)}
          </p>
        </div>
      </div>

      {/* Form Pengaturan Operasional & Profil Toko */}
      <form
        onSubmit={handleSaveSettings}
        style={{ animationDelay: "90ms" }}
        className="animate-fade-slide-up space-y-5 rounded-2xl border border-border bg-background p-5 shadow-xs lg:col-span-7"
      >
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Store className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">
            Pengaturan Operasional &amp; Profil Toko
          </h2>
        </div>

        {/* Profil Toko */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-foreground">Nama Restoran</label>
            <input
              type="text"
              required
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground">Nomor WhatsApp</label>
            <input
              type="text"
              required
              value={phoneWhatsapp}
              onChange={(e) => setPhoneWhatsapp(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground">Jam Operasional</label>
            <input
              type="text"
              required
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground">Alamat Lengkap</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground">
              Kedaluwarsa Bayar Digital (Menit)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={digitalExpiryMinutes}
              onChange={(e) => setDigitalExpiryMinutes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground">
              Kedaluwarsa Bayar Tunai (Menit)
            </label>
            <input
              type="number"
              min={5}
              max={240}
              value={cashExpiryMinutes}
              onChange={(e) => setCashExpiryMinutes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground">
              Catatan Kaki Struk
            </label>
            <input
              type="text"
              value={receiptFooterNote}
              onChange={(e) => setReceiptFooterNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground">
              Alasan Perubahan untuk Audit Log (Opsional)
            </label>
            <input
              type="text"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Contoh: Perubahan jam buka operasional atau catatan kaki struk"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Menyimpan..." : "Simpan Pengaturan Toko"}
          </button>
        </div>
      </form>
    </div>
  );
}

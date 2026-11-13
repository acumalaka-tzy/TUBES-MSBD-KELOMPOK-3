"use client";

import React from "react";
import { Utensils, Package, User, Phone, FileText, ChevronDown } from "lucide-react";
import { TableItem } from "@/actions/types";

interface CustomerFormProps {
  serviceType: "DINE_IN" | "TAKEAWAY";
  onServiceTypeChange: (type: "DINE_IN" | "TAKEAWAY") => void;
  tableNumber: string;
  onTableNumberChange: (table: string) => void;
  tables: TableItem[];
  customerName: string;
  onCustomerNameChange: (val: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (val: string) => void;
  notes: string;
  onNotesChange: (val: string) => void;
}

export function CustomerForm({
  serviceType,
  onServiceTypeChange,
  tableNumber,
  onTableNumberChange,
  tables,
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  notes,
  onNotesChange,
}: CustomerFormProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
            1
          </span>
          Informasi Pemesan & Layanan
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pilih cara penyajian dan lengkapi data pemesan Anda
        </p>
      </div>

      {/* Pilihan Dine In / Takeaway */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Tipe Layanan <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onServiceTypeChange("DINE_IN")}
            className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border-2 text-sm font-bold transition-all ${
              serviceType === "DINE_IN"
                ? "border-primary bg-primary/5 text-primary shadow-xs"
                : "border-border hover:bg-secondary-bg text-muted-foreground"
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Makan di Tempat (Dine In)</span>
          </button>

          <button
            type="button"
            onClick={() => onServiceTypeChange("TAKEAWAY")}
            className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border-2 text-sm font-bold transition-all ${
              serviceType === "TAKEAWAY"
                ? "border-primary bg-primary/5 text-primary shadow-xs"
                : "border-border hover:bg-secondary-bg text-muted-foreground"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Bungkus (Takeaway)</span>
          </button>
        </div>
      </div>

      {/* Pilihan Meja (Hanya tampil jika Dine In) */}
      {serviceType === "DINE_IN" && (
        <div className="p-4 rounded-xl bg-secondary-bg/60 border border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="table-number-select"
              className="block text-xs font-bold text-muted-foreground uppercase tracking-wider"
            >
              Pilih Nomor Meja <span className="text-destructive">*</span>
            </label>
            {tables.length > 0 && (
              <span className="text-[11px] font-mono text-muted-foreground">
                Tersedia {tables.length} meja
              </span>
            )}
          </div>

          <div className="relative">
            <Utensils className="w-4 h-4 text-primary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              id="table-number-select"
              required
              value={tableNumber}
              onChange={(e) => onTableNumberChange(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-card border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer shadow-2xs"
            >
              <option value="" disabled>
                -- Pilih Nomor Meja Anda --
              </option>
              {tables.map((t) => (
                <option key={t.id} value={t.table_number}>
                  Meja {t.table_number} {t.name && t.name !== `Meja ${t.table_number}` ? `• ${t.name}` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {tableNumber && (
            <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>
                Pesanan akan disajikan ke <strong className="text-foreground">Meja {tableNumber}</strong>.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Input Nama & WhatsApp */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Nama Pemesan <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              placeholder="Contoh: Bang Budi"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-secondary-bg/40 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Nomor WhatsApp <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              required
              placeholder="Contoh: 081234567890"
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-secondary-bg/40 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
            />
          </div>
        </div>
      </div>

      {/* Catatan Khusus */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          Catatan Pesanan (Opsional)
        </label>
        <div className="relative">
          <FileText className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
          <textarea
            rows={2}
            placeholder="Contoh: Sanger jangan terlalu manis, indomie kuah sedikit kental"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-secondary-bg/40 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
          />
        </div>
      </div>
    </div>
  );
}


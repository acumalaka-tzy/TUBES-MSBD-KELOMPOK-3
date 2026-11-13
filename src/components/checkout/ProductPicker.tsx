"use client";

import React from "react";
import { Database, Plus } from "lucide-react";
import { AvailableProduct } from "@/actions/types";

interface ProductPickerProps {
  products: AvailableProduct[];
  onAddProduct: (product: AvailableProduct) => void;
}

export function ProductPicker({ products, onAddProduct }: ProductPickerProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className="pt-3 border-t border-border">
      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2">
        <Database className="w-3.5 h-3.5 text-primary" />
        <span>Pilih Menu Asli dari Database MySQL:</span>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-2 rounded-xl bg-secondary-bg hover:bg-border/60 transition-colors text-xs"
          >
            <div className="min-w-0 pr-2">
              <p className="font-bold text-foreground truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                Rp {p.base_price.toLocaleString("id-ID")} • Sisa: {p.available_qty} porsi
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAddProduct(p)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-primary hover:text-white border border-border text-foreground text-xs font-bold rounded-lg transition-all shadow-2xs shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>Tambah</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import React from "react";

interface OrderInvoiceProps {
  order: any;
}

export function OrderInvoice({ order }: OrderInvoiceProps) {
  return (
    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wider pb-3 border-b border-border">
        Rincian Item yang Dipesan
      </h2>

      <div className="divide-y divide-border my-2">
        {order.items?.map((item: any) => (
          <div key={item.id} className="py-3.5 flex justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">
                {item.product_name_snapshot}
              </p>

              {item.options && item.options.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.options
                    .map((o: any) => `${o.option_name_snapshot}`)
                    .join(", ")}
                </p>
              )}

              {item.item_notes && (
                <p className="text-xs text-primary/80 italic mt-0.5">
                  "{item.item_notes}"
                </p>
              )}

              <p className="text-xs text-muted-foreground mt-1">
                {item.quantity} x Rp {Number(item.unit_price_snapshot).toLocaleString("id-ID")}
              </p>
            </div>

            <span className="font-mono text-sm font-bold text-foreground shrink-0">
              Rp {Number(item.subtotal).toLocaleString("id-ID")}
            </span>
          </div>
        ))}
      </div>

      {/* Total Rincian */}
      <div className="pt-4 border-t border-border space-y-1.5 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-mono font-medium">
            Rp {Number(order.subtotal).toLocaleString("id-ID")}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Pajak Restoran (PB1 10%)</span>
          <span className="font-mono font-medium">
            Rp {Number(order.tax_amount).toLocaleString("id-ID")}
          </span>
        </div>
        <div className="flex justify-between text-foreground font-black text-base pt-2 border-t border-border">
          <span>Total Pembayaran</span>
          <span className="font-mono text-primary text-lg">
            Rp {Number(order.total_amount).toLocaleString("id-ID")}
          </span>
        </div>
      </div>

      {/* Info Pemesan */}
      <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Pemesan:</strong> {order.customer_name} ({order.customer_phone})
        </p>
        {order.notes && (
          <p>
            <strong>Catatan Pesanan:</strong> {order.notes}
          </p>
        )}
      </div>
    </div>
  );
}

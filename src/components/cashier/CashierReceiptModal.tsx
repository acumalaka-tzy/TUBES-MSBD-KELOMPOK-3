"use client";

import { useState, useTransition } from "react";
import {
  Printer,
  X,
  CheckCircle2,
  Receipt,
  FileText,
  Sparkles,
} from "lucide-react";
import type { AdminSettings } from "@/lib/admin/types";
import type { CashierOrder } from "@/lib/cashier/types";
import { recordReceiptPrintAction } from "@/app/actions/cashier";

interface CashierReceiptModalProps {
  order: CashierOrder | null;
  settings: AdminSettings;
  cashierName: string;
  onClose: () => void;
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CashierReceiptModal({
  order,
  settings,
  cashierName,
  onClose,
}: CashierReceiptModalProps) {
  const [paperSize, setPaperSize] = useState<"58MM" | "80MM">("58MM");
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!order) return null;

  const datePart = new Date(order.createdAt).toISOString().slice(0, 10).replace(/-/g, "");
  const suffixPart = order.orderNumber.split("-").pop() || "001";
  const displayReceiptNo = receiptNumber || `RCP-${datePart}-${suffixPart}`;

  const handlePrint = () => {
    setPrintSuccessMsg(null);
    startTransition(async () => {
      try {
        const res = await recordReceiptPrintAction({
          orderNumber: order.orderNumber,
          paperSize,
        });
        if (res.receiptNumber) {
          setReceiptNumber(res.receiptNumber);
        }
      } catch {
        // Ignore error and proceed to browser print
      }

      // Cetak menggunakan jendela print khusus berformat termal 58mm / 80mm
      const receiptEl = document.getElementById("warkop-thermal-receipt-area");
      if (!receiptEl) {
        window.print();
        return;
      }

      const widthMm = paperSize === "58MM" ? "58mm" : "80mm";
      const printWindow = window.open("", "_blank", "width=420,height=720");

      if (!printWindow) {
        // Fallback ke window.print() bila popup diblokir browser
        window.print();
        setPrintSuccessMsg(`Struk ${paperSize} dikirim ke dialog cetak browser.`);
        return;
      }

      const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Struk ${order.orderNumber} (${paperSize})</title>
  <style>
    @page {
      size: ${widthMm} auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Courier New", Courier, monospace;
      width: ${widthMm};
      max-width: ${widthMm};
      margin: 0 auto;
      padding: ${paperSize === "58MM" ? "3mm 2.5mm" : "4mm 4mm"};
      color: #000;
      background: #fff;
      font-size: ${paperSize === "58MM" ? "11px" : "12px"};
      line-height: 1.38;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .title { font-size: ${paperSize === "58MM" ? "14px" : "16px"}; font-weight: bold; text-transform: uppercase; }
    .subtitle { font-size: ${paperSize === "58MM" ? "10px" : "11px"}; margin-top: 2px; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; margin: 2px 0; }
    .item-block { margin: 4px 0; }
    .item-meta { font-size: ${paperSize === "58MM" ? "10px" : "11px"}; padding-left: 8px; color: #222; }
    .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: ${paperSize === "58MM" ? "13px" : "14px"}; margin: 4px 0; }
    .badge { display: inline-block; border: 1px solid #000; padding: 1px 5px; font-weight: bold; font-size: 10px; margin-top: 3px; }
    .footer { text-align: center; font-size: ${paperSize === "58MM" ? "10px" : "11px"}; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="center">
    <div class="title">${settings.restaurantName || "Warkop Agam"}</div>
    <div class="subtitle">${settings.address || "Jl. Iskandar Muda, Medan Baru"}</div>
    <div class="subtitle">WA: ${settings.phoneWhatsapp || "0812-3456-7890"}</div>
    <div class="badge">${
      order.serviceType === "DINE_IN"
        ? `DINE IN • MEJA ${order.tableNumber || "-"}`
        : "TAKEAWAY / BUNGKUS"
    }</div>
  </div>

  <div class="divider"></div>

  <div class="row"><span>No. Struk</span><span>${displayReceiptNo}</span></div>
  <div class="row"><span>No. Order</span><span class="bold">${order.orderNumber}</span></div>
  <div class="row"><span>Waktu</span><span>${formatDateTime(order.createdAt)}</span></div>
  <div class="row"><span>Pelanggan</span><span>${order.customerName}</span></div>
  <div class="row"><span>Kasir</span><span>${order.payment.cashierName || cashierName}</span></div>
  <div class="row"><span>Sumber</span><span>${order.source === "POS" ? "POS Kasir" : "Web / QR Meja"}</span></div>

  <div class="divider"></div>

  ${order.items
    .map(
      (item) => `
    <div class="item-block">
      <div class="bold">${item.name}</div>
      <div class="row">
        <span>${item.quantity} x ${formatRupiah(item.unitPrice)}</span>
        <span>${formatRupiah(item.subtotal)}</span>
      </div>
      ${item.options
        .map(
          (opt) =>
            `<div class="item-meta">+ ${opt.groupName}: ${opt.optionName}${
              opt.priceAdjustment > 0 ? ` (${formatRupiah(opt.priceAdjustment)})` : ""
            }</div>`,
        )
        .join("")}
      ${item.itemNotes ? `<div class="item-meta">* Catatan: ${item.itemNotes}</div>` : ""}
    </div>
  `,
    )
    .join("")}

  <div class="divider"></div>

  <div class="row"><span>Subtotal</span><span>${formatRupiah(order.subtotal)}</span></div>
  <div class="row"><span>PB1 (${settings.taxPercentage}%)</span><span>${formatRupiah(order.taxAmount)}</span></div>
  <div class="total-row"><span>TOTAL</span><span>${formatRupiah(order.totalAmount)}</span></div>

  <div class="divider"></div>

  <div class="row">
    <span>Metode Bayar</span>
    <span class="bold">${
      order.payment.method === "CASH"
        ? "TUNAI (CASH)"
        : order.payment.method === "QRIS"
          ? "QRIS"
          : "VIRTUAL ACCOUNT"
    }</span>
  </div>
  <div class="row">
    <span>Status Bayar</span>
    <span class="bold">${order.payment.status === "PAID" ? "LUNAS" : "BELUM BAYAR"}</span>
  </div>
  ${
    order.payment.status === "PAID"
      ? `
    <div class="row"><span>Nominal Bayar</span><span>${formatRupiah(
      order.payment.amountPaid || order.totalAmount,
    )}</span></div>
    <div class="row bold"><span>Kembalian</span><span>${formatRupiah(
      order.payment.changeAmount || 0,
    )}</span></div>
  `
      : ""
  }

  <div class="divider"></div>

  <div class="footer">
    <div>${
      settings.receiptFooterNote ||
      "Terima kasih telah singgah di Warkop Agam. Kopi sanger hangat menanti Anda kembali!"
    }</div>
    <div style="margin-top:4px;">Ukuran Kertas: ${paperSize === "58MM" ? "58mm" : "80mm"}</div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 180);
    };
  </script>
</body>
</html>`;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setPrintSuccessMsg(
        `Struk ${displayReceiptNo} (${paperSize === "58MM" ? "58mm" : "80mm"}) siap dicetak / disimpan sebagai PDF.`,
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-border bg-[#0E2A2E] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                Cetak Struk Termal (58mm / 80mm)
              </h3>
              <p className="text-xs text-white/75">
                {order.orderNumber} • {order.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
            aria-label="Tutup modal struk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar Pilihan Ukuran Kertas */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[#F4F7F6] px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Ukuran Kertas:</span>
            <button
              type="button"
              onClick={() => setPaperSize("58MM")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                paperSize === "58MM"
                  ? "bg-[#0E2A2E] text-white shadow-xs"
                  : "border border-border bg-white text-foreground hover:bg-muted"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Thermal 58mm (Standar)</span>
            </button>
            <button
              type="button"
              onClick={() => setPaperSize("80MM")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                paperSize === "80MM"
                  ? "bg-[#0E2A2E] text-white shadow-xs"
                  : "border border-border bg-white text-foreground hover:bg-muted"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Thermal 80mm (Lebar)</span>
            </button>
          </div>

          <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-bold text-emerald-700">
            CSS Print &amp; PDF Ready
          </span>
        </div>

        {printSuccessMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{printSuccessMsg}</span>
          </div>
        )}

        {/* Pratinjau Kertas Struk Termal */}
        <div className="flex-1 overflow-y-auto bg-neutral-200/70 p-6">
          <div
            id="warkop-thermal-receipt-area"
            className={`mx-auto rounded-md border border-neutral-300 bg-white font-mono text-black shadow-lg transition-all ${
              paperSize === "58MM"
                ? "w-[260px] p-4 text-[11px] leading-snug"
                : "w-[350px] p-5 text-[12px] leading-normal"
            }`}
          >
            {/* Header Toko */}
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-wide">
                {settings.restaurantName || "Warkop Agam"}
              </p>
              <p className="mt-0.5 text-[10px] text-neutral-700">
                {settings.address || "Jl. Iskandar Muda, Medan Baru"}
              </p>
              <p className="text-[10px] text-neutral-700">
                WA: {settings.phoneWhatsapp || "0812-3456-7890"}
              </p>
              <div className="mt-2 inline-block border border-black px-2 py-0.5 text-[10px] font-extrabold uppercase">
                {order.serviceType === "DINE_IN"
                  ? `DINE IN • MEJA ${order.tableNumber || "-"}`
                  : "TAKEAWAY / BUNGKUS"}
              </div>
            </div>

            <div className="my-2.5 border-t border-dashed border-black" />

            {/* Metadata Transaksi */}
            <div className="space-y-1">
              <div className="flex justify-between gap-2">
                <span>No. Struk</span>
                <span className="font-bold">{displayReceiptNo}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>No. Order</span>
                <span className="font-bold">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Waktu</span>
                <span>{formatDateTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Pelanggan</span>
                <span className="font-bold">{order.customerName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Kasir</span>
                <span>{order.payment.cashierName || cashierName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Sumber</span>
                <span>{order.source === "POS" ? "POS Kasir" : "Web / QR Meja"}</span>
              </div>
            </div>

            <div className="my-2.5 border-t border-dashed border-black" />

            {/* Daftar Item */}
            <div className="space-y-2.5">
              {order.items.map((item) => (
                <div key={item.id}>
                  <p className="font-bold">{item.name}</p>
                  <div className="flex justify-between">
                    <span>
                      {item.quantity} x {formatRupiah(item.unitPrice)}
                    </span>
                    <span className="font-bold">{formatRupiah(item.subtotal)}</span>
                  </div>
                  {item.options.length > 0 && (
                    <div className="mt-0.5 space-y-0.5 pl-2 text-[10px] text-neutral-700">
                      {item.options.map((opt, idx) => (
                        <p key={idx}>
                          + {opt.groupName}: {opt.optionName}
                          {opt.priceAdjustment > 0
                            ? ` (${formatRupiah(opt.priceAdjustment)})`
                            : ""}
                        </p>
                      ))}
                    </div>
                  )}
                  {item.itemNotes && (
                    <p className="mt-0.5 pl-2 text-[10px] italic text-neutral-700">
                      * Catatan: {item.itemNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="my-2.5 border-t border-dashed border-black" />

            {/* Rincian Harga */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatRupiah(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>PB1 ({settings.taxPercentage}%)</span>
                <span>{formatRupiah(order.taxAmount)}</span>
              </div>
              <div className="flex justify-between pt-1 text-xs font-black">
                <span>TOTAL TAGIHAN</span>
                <span>{formatRupiah(order.totalAmount)}</span>
              </div>
            </div>

            <div className="my-2.5 border-t border-dashed border-black" />

            {/* Rincian Pembayaran & Kembalian */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Metode Bayar</span>
                <span className="font-bold">
                  {order.payment.method === "CASH"
                    ? "TUNAI (CASH)"
                    : order.payment.method === "QRIS"
                      ? "QRIS"
                      : "VIRTUAL ACCOUNT"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status Bayar</span>
                <span className="font-bold">
                  {order.payment.status === "PAID" ? "LUNAS (PAID)" : "BELUM DIBAYAR"}
                </span>
              </div>
              {order.payment.status === "PAID" && (
                <>
                  <div className="flex justify-between">
                    <span>Tunai Diterima</span>
                    <span>
                      {formatRupiah(order.payment.amountPaid || order.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between font-black">
                    <span>Kembalian</span>
                    <span>{formatRupiah(order.payment.changeAmount || 0)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="my-2.5 border-t border-dashed border-black" />

            {/* Catatan Kaki Struk */}
            <div className="text-center text-[10px] text-neutral-700">
              <p>
                {settings.receiptFooterNote ||
                  "Terima kasih telah singgah di Warkop Agam. Kopi sanger hangat menanti Anda kembali!"}
              </p>
              <p className="mt-1 font-bold">
                — Format Kertas {paperSize === "58MM" ? "58mm" : "80mm"} —
              </p>
            </div>
          </div>
        </div>

        {/* Footer Aksi */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-white px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>
              Pilih printer termal atau <strong>Save as PDF</strong> pada jendela cetak.
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              <span>
                {isPending
                  ? "Menyiapkan Struk..."
                  : `Cetak Struk ${paperSize === "58MM" ? "58mm" : "80mm"} / PDF`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

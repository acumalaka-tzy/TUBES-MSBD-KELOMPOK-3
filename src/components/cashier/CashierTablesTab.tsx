"use client";

import { useState, useTransition } from "react";
import {
  Utensils,
  Users,
  CheckCircle2,
  PlusCircle,
  RotateCcw,
  Banknote,
  Printer,
  Clock,
  Sparkles,
} from "lucide-react";
import type { CashierOrder, CashierTableInfo } from "@/lib/cashier/types";
import { setTableStatusCashierAction } from "@/app/actions/cashier";

interface CashierTablesTabProps {
  tables: CashierTableInfo[];
  orders: CashierOrder[];
  onCreatePosOrderAtTable: (tableNumber: string) => void;
  onOpenCashModal: (order: CashierOrder) => void;
  onOpenReceiptModal: (order: CashierOrder) => void;
  onRefreshData: () => Promise<void>;
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

export function CashierTablesTab({
  tables,
  orders,
  onCreatePosOrderAtTable,
  onOpenCashModal,
  onOpenReceiptModal,
  onRefreshData,
  onNotify,
}: CashierTablesTabProps) {
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "OCCUPIED">("ALL");
  const [pendingTableNo, setPendingTableNo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeTables = tables.filter((t) => t.isActive);
  const availableCount = activeTables.filter((t) => t.status === "AVAILABLE").length;
  const occupiedCount = activeTables.filter((t) => t.status === "OCCUPIED").length;

  const filteredTables = activeTables.filter((t) => {
    if (statusFilter === "AVAILABLE") return t.status === "AVAILABLE";
    if (statusFilter === "OCCUPIED") return t.status === "OCCUPIED";
    return true;
  });

  const handleToggleTableStatus = (
    tableNumber: string,
    nextStatus: "AVAILABLE" | "OCCUPIED",
  ) => {
    setPendingTableNo(tableNumber);
    startTransition(async () => {
      const res = await setTableStatusCashierAction({
        tableNumber,
        status: nextStatus,
      });
      setPendingTableNo(null);

      if (res.success) {
        onNotify(
          res.message ||
            (nextStatus === "AVAILABLE"
              ? `Meja ${tableNumber} telah dikosongkan.`
              : `Meja ${tableNumber} ditandai terisi.`),
          "success",
        );
        await onRefreshData();
      } else {
        onNotify(res.error || "Gagal memperbarui status meja.", "error");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Header Bar Filter & Ringkasan Meja */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-extrabold text-foreground">
            Pemantauan Status Meja Dine-In Real-Time
          </h3>
          <p className="text-xs text-muted-foreground">
            Pantau meja terisi atau kosong, lihat pesanan aktif di setiap meja, dan kosongkan meja
            saat pelanggan selesai bersantap.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
              statusFilter === "ALL"
                ? "bg-[#0E2A2E] text-white shadow-xs"
                : "border border-border bg-[#F4F7F6] text-foreground hover:bg-muted"
            }`}
          >
            <span>Semua Meja</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[11px]">
              {activeTables.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("AVAILABLE")}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
              statusFilter === "AVAILABLE"
                ? "bg-emerald-600 text-white shadow-xs"
                : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/20"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Kosong (Siap Pakai)</span>
            <span className="rounded-full bg-black/15 px-2 py-0.5 font-mono text-[11px]">
              {availableCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("OCCUPIED")}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
              statusFilter === "OCCUPIED"
                ? "bg-amber-600 text-white shadow-xs"
                : "border border-amber-500/30 bg-amber-500/10 text-amber-900 hover:bg-amber-500/20"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Terisi (Digunakan)</span>
            <span className="rounded-full bg-black/15 px-2 py-0.5 font-mono text-[11px]">
              {occupiedCount}
            </span>
          </button>
        </div>
      </div>

      {/* Grid Kartu Meja */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredTables.map((table) => {
          const isOccupied = table.status === "OCCUPIED";
          const isBusy = isPending && pendingTableNo === table.tableNumber;

          return (
            <div
              key={table.id}
              className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-md ${
                isOccupied
                  ? "border-amber-500/50 ring-1 ring-amber-500/15"
                  : "border-emerald-500/30"
              }`}
            >
              <div>
                {/* Header Kartu Meja */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl font-mono text-lg font-black shadow-2xs ${
                        isOccupied
                          ? "bg-amber-500 text-white"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      {table.tableNumber}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-foreground">{table.name}</h4>
                      <p className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>Kapasitas {table.capacity} Kursi</span>
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                      isOccupied
                        ? "bg-amber-500/15 text-amber-900"
                        : "bg-emerald-500/15 text-emerald-800"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isOccupied ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                      }`}
                    />
                    {isOccupied ? "Terisi" : "Kosong"}
                  </span>
                </div>

                {/* Daftar Pesanan Aktif pada Meja */}
                <div className="mt-4 space-y-2">
                  {table.activeOrders.length === 0 ? (
                    <div
                      className={`rounded-xl border border-dashed px-3.5 py-4 text-center text-xs ${
                        isOccupied
                          ? "border-amber-500/30 bg-amber-500/5 text-amber-900"
                          : "border-border bg-[#F4F7F6] text-muted-foreground"
                      }`}
                    >
                      {isOccupied
                        ? "Meja sedang ditempati pelanggan (belum ada pesanan aktif terbuka)."
                        : "Meja bersih & siap ditempati pelanggan baru."}
                    </div>
                  ) : (
                    table.activeOrders.map((act) => {
                      const fullOrder = orders.find((o) => o.orderNumber === act.orderNumber);
                      const isOrderUnpaidCash =
                        fullOrder &&
                        fullOrder.payment.status === "UNPAID" &&
                        fullOrder.payment.method === "CASH";

                      return (
                        <div
                          key={act.orderNumber}
                          className="rounded-xl border border-border bg-[#F4F7F6] p-3 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-[#0E2A2E]">
                              {act.orderNumber}
                            </span>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                                act.paymentStatus === "PAID"
                                  ? "bg-emerald-500/15 text-emerald-800"
                                  : "bg-amber-500/20 text-amber-900"
                              }`}
                            >
                              {act.paymentStatus === "PAID" ? "LUNAS" : "BELUM BAYAR"}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="font-bold text-foreground">{act.customerName}</span>
                            <span className="font-mono font-extrabold text-[#0E2A2E]">
                              {formatRupiah(act.totalAmount)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-border/70 pt-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                              <Clock className="h-3 w-3" />
                              Status: {act.status}
                            </span>
                            {fullOrder && (
                              <div className="flex items-center gap-1">
                                {isOrderUnpaidCash && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenCashModal(fullOrder)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-extrabold text-white hover:bg-emerald-700"
                                  >
                                    <Banknote className="h-3 w-3" />
                                    <span>Bayar</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onOpenReceiptModal(fullOrder)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-[10px] font-bold text-foreground hover:bg-muted"
                                >
                                  <Printer className="h-3 w-3" />
                                  <span>Struk</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Tombol Aksi Pengosongan Meja / Buat Pesanan */}
              <div className="mt-4 space-y-2 border-t border-border/80 pt-3.5">
                {isOccupied ? (
                  <>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleTableStatus(table.tableNumber, "AVAILABLE")}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {isBusy ? "Mengosongkan..." : "Kosongkan Meja (Selesai)"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCreatePosOrderAtTable(table.tableNumber)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-[#F4F7F6] px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
                    >
                      <PlusCircle className="h-3.5 w-3.5 text-primary" />
                      <span>Tambah Pesanan ke Meja {table.tableNumber}</span>
                    </button>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onCreatePosOrderAtTable(table.tableNumber)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0E2A2E] px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-primary"
                    >
                      <Utensils className="h-3.5 w-3.5" />
                      <span>Input POS</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleTableStatus(table.tableNumber, "OCCUPIED")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-[#F4F7F6] px-3 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      <span>Tandai Terisi</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Utensils, Clock, CheckCircle2, RefreshCw, ChefHat, LogOut, Coffee } from "lucide-react";
import { updateKitchenOrderStatusAction, type KitchenQueueItem } from "@/app/actions/chef";
import { logoutAction } from "@/app/actions/auth";

interface ChefViewProps {
  initialQueue: KitchenQueueItem[];
  chefName: string;
}

export function ChefDashboardView({ initialQueue, chefName }: ChefViewProps) {
  const [queue, setQueue] = useState<KitchenQueueItem[]>(initialQueue);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleUpdateStatus = (orderId: string, nextStatus: "PREPARING" | "READY" | "COMPLETED") => {
    startTransition(async () => {
      const res = await updateKitchenOrderStatusAction(orderId, nextStatus);
      if (res.success) {
        setQueue((prev) =>
          prev.map((item) =>
            item.order_id === orderId ? { ...item, order_status: nextStatus as any } : item
          )
        );
        router.refresh();
      } else {
        alert(res.error || "Gagal mengubah status pesanan");
      }
    });
  };

  const filtered = queue.filter((item) => {
    if (filterStatus === "ALL") return true;
    return item.order_status === filterStatus;
  });

  const countPending = queue.filter((q) => q.order_status === "PENDING" || q.order_status === "CONFIRMED").length;
  const countPreparing = queue.filter((q) => q.order_status === "PREPARING").length;
  const countReady = queue.filter((q) => q.order_status === "READY").length;

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="bg-[#1E293B] border-b border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Kitchen Display System (KDS)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                vw_active_kitchen_queue
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Antrean Masak & Minuman Real-time • Halo, Chef {chefName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 border border-slate-600 transition"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={async () => {
              await logoutAction();
              window.location.href = "/login";
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-lg border border-rose-500/30 transition"
          >
            <LogOut className="h-4 w-4" /> Keluar
          </button>
        </div>
      </header>

      {/* Metrics & Filter */}
      <div className="px-6 py-4 bg-[#1E293B]/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus("ALL")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filterStatus === "ALL"
                ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Semua ({queue.length})
          </button>
          <button
            onClick={() => setFilterStatus("CONFIRMED")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filterStatus === "CONFIRMED"
                ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Antre ({countPending})
          </button>
          <button
            onClick={() => setFilterStatus("PREPARING")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filterStatus === "PREPARING"
                ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Dimasak ({countPreparing})
          </button>
          <button
            onClick={() => setFilterStatus("READY")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filterStatus === "READY"
                ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Siap Saji ({countReady})
          </button>
        </div>

        <div className="text-xs text-slate-400">
          Setiap perpindahan status memicu Trigger Database <span className="text-amber-400 font-mono">trg_audit_order_status_change</span>
        </div>
      </div>

      {/* Grid Order Cards */}
      <main className="p-6 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="h-72 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400">
            <Coffee className="h-12 w-12 text-slate-500 mb-2" />
            <p className="text-base font-semibold text-slate-300">Tidak ada antrean pesanan di dapur saat ini.</p>
            <p className="text-xs text-slate-500">Pesanan baru yang dikonfirmasi kasir akan muncul secara otomatis di sini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((order) => {
              const isPreparing = order.order_status === "PREPARING";
              const isReady = order.order_status === "READY";

              return (
                <div
                  key={order.order_id}
                  className={`rounded-xl border flex flex-col justify-between transition shadow-lg ${
                    isReady
                      ? "bg-emerald-950/30 border-emerald-500/40"
                      : isPreparing
                      ? "bg-blue-950/30 border-blue-500/40 ring-1 ring-blue-500/20"
                      : "bg-[#1E293B] border-slate-700"
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-700/60">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg font-black text-amber-400">
                        #{order.order_number}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          isReady
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : isPreparing
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {order.order_status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                      <span className="font-semibold text-slate-200">
                        {order.table_number ? `Meja ${order.table_number}` : "Takeaway / Bawa Pulang"}
                      </span>
                      <span>{order.customer_name}</span>
                    </div>
                  </div>

                  {/* Item List */}
                  <div className="p-4 flex-1 space-y-3">
                    {order.items.map((it) => (
                      <div key={it.id} className="border-b border-slate-800 pb-2 last:border-none">
                        <div className="flex items-start justify-between">
                          <span className="font-medium text-sm text-slate-100">
                            {it.product_name}
                          </span>
                          <span className="text-sm font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                            x{it.quantity}
                          </span>
                        </div>
                        {it.options && it.options.length > 0 && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            Varian: {it.options.join(", ")}
                          </div>
                        )}
                        {it.notes && (
                          <div className="text-xs text-amber-300/80 italic mt-0.5">
                            Catatan: {it.notes}
                          </div>
                        )}
                      </div>
                    ))}

                    {order.order_notes && (
                      <div className="p-2 bg-slate-800/80 rounded border border-slate-700 text-xs text-amber-200">
                        <strong>Catatan Pesanan:</strong> {order.order_notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-3 bg-slate-900/40 border-t border-slate-700/60 flex items-center gap-2">
                    {order.order_status === "CONFIRMED" || order.order_status === "PENDING" ? (
                      <button
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(order.order_id, "PREPARING")}
                        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <Clock className="h-4 w-4" /> Mulai Masak (PREPARING)
                      </button>
                    ) : order.order_status === "PREPARING" ? (
                      <button
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(order.order_id, "READY")}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Siap Saji (READY)
                      </button>
                    ) : (
                      <button
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(order.order_id, "COMPLETED")}
                        className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-medium transition"
                      >
                        Selesai Disajikan (COMPLETED)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

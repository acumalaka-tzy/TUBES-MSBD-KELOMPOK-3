"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  Boxes,
  Calculator,
  CheckCircle2,
  ChefHat,
  Coffee,
  Database,
  ExternalLink,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  Wallet,
  X,
  XCircle,
  Utensils,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { getCashierDashboardData } from "@/app/actions/cashier";
import type {
  CashierDashboardPayload,
  CashierOrder,
  CashierTabKey,
} from "@/lib/cashier/types";
import { CashierQueueTab } from "./CashierQueueTab";
import { CashierPosTab } from "./CashierPosTab";
import { CashierTablesTab } from "./CashierTablesTab";
import { CashierHistoryTab, CashierStockTab } from "./CashierHistoryStockTabs";
import { CashierPaymentModal } from "./CashierPaymentModal";
import { CashierReceiptModal } from "./CashierReceiptModal";

interface CashierDashboardShellProps {
  cashierUser: {
    id: string;
    name: string;
    phone: string;
    role: string;
  };
  initialData: CashierDashboardPayload;
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

export function CashierDashboardShell({
  cashierUser,
  initialData,
}: CashierDashboardShellProps) {
  const [data, setData] = useState<CashierDashboardPayload>(initialData);
  const [activeTab, setActiveTab] = useState<CashierTabKey>("queue");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Audio Alert (Notifikasi Suara Pesanan Web Masuk)
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const knownWebOrderIdsRef = useRef<Set<string>>(
    new Set(
      initialData.orders
        .filter((o) => o.source === "WEB")
        .map((o) => o.orderNumber),
    ),
  );

  // Toast Notification
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Modal Pembayaran Tunai & Modal Cetak Struk 58/80mm
  const [cashModalOrder, setCashModalOrder] = useState<CashierOrder | null>(null);
  const [receiptModalOrder, setReceiptModalOrder] = useState<CashierOrder | null>(null);

  // Preselected table saat kasir klik "Input POS" dari tab Status Meja
  const [preselectedPosTable, setPreselectedPosTable] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = useCallback(
    (text: string, type: "success" | "error" | "info" = "success") => {
      if (!text) return;
      setToast({ type, text });
    },
    [],
  );

  // Synthesizer Lonceng Kasir (Web Audio API Chime)
  const playAudioAlert = useCallback(() => {
    if (!audioEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Nada 1 (Ding - E5 659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.32, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.36);

      // Nada 2 (Dong tinggi - A5 880 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(880, now + 0.18);
      gain2.gain.setValueAtTime(0.001, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.36, now + 0.21);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.8);
    } catch {
      // Browser autoplay restriction ignored
    }
  }, [audioEnabled]);

  // Fungsi refresh data real-time + deteksi pesanan web baru
  const refreshDashboardData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const latest = await getCashierDashboardData();
      setData(latest);

      // Cek apakah ada pesanan WEB baru yang belum pernah tercatat
      const newWebOrders = latest.orders.filter(
        (o) => o.source === "WEB" && !knownWebOrderIdsRef.current.has(o.orderNumber),
      );

      if (newWebOrders.length > 0) {
        for (const nw of newWebOrders) {
          knownWebOrderIdsRef.current.add(nw.orderNumber);
        }
        playAudioAlert();
        const newest = newWebOrders[0];
        notify(
          `🔔 Pesanan Web Baru Masuk: ${newest.orderNumber} (${newest.customerName}${
            newest.tableNumber ? ` • Meja ${newest.tableNumber}` : ""
          })`,
          "info",
        );
      }
    } catch {
      // Ignore transient network poll error
    } finally {
      setIsSyncing(false);
    }
  }, [notify, playAudioAlert]);

  // Polling Real-Time setiap 5 detik
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshDashboardData();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshDashboardData]);

  const { metrics, settings, dataSource } = data;
  const activeCookingAndReady = metrics.preparingCount + metrics.readyCount;

  const navMenuItems: {
    key: CashierTabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeTone?: string;
  }[] = [
    {
      key: "queue",
      label: "Antrean Pesanan",
      icon: BellRing,
      badge: metrics.needActionCount > 0 ? metrics.needActionCount : undefined,
      badgeTone: "bg-amber-500 text-white",
    },
    {
      key: "pos",
      label: "POS Manual (Kasir)",
      icon: Calculator,
    },
    {
      key: "tables",
      label: "Status Meja",
      icon: Utensils,
      badge: metrics.occupiedTablesCount > 0 ? metrics.occupiedTablesCount : undefined,
      badgeTone: "bg-emerald-500 text-white",
    },
    {
      key: "history",
      label: "Riwayat & Cetak Struk",
      icon: History,
    },
    {
      key: "stock",
      label: "Cek Stok Menu",
      icon: Boxes,
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#F4F7F6] text-foreground font-sans">
      {/* =====================================================================
       * SIDEBAR DESKTOP & MOBILE DRAWER (SERAGAM DENGAN ADMIN DASHBOARD)
       * =================================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between bg-[#0E2A2E] text-white shadow-xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header Brand */}
        <div>
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                <Coffee className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base leading-tight font-black tracking-tight text-white">
                  {settings.restaurantName || "Warkop Agam"}
                </h1>
                <p className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                  Cashier POS System
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="rounded-lg p-1 text-white/70 hover:bg-white/10 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigasi Menu Vertikal (Pills Style Seragam dengan Admin) */}
          <nav className="space-y-1 px-3 py-4" aria-label="Sidebar Menu Kasir">
            {navMenuItems.map((item) => {
              const active = activeTab === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.key);
                    setMobileSidebarOpen(false);
                  }}
                  className={`group flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                    active
                      ? "bg-white font-extrabold text-[#0E2A2E] shadow-sm"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        active ? "text-primary" : "text-white/70 group-hover:text-white"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        active
                          ? item.badgeTone || "bg-amber-500 text-white"
                          : "bg-amber-400/20 text-amber-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Kartu Ringkas Status Audio Alert di Sidebar */}
          <div className="mx-3 mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/90">
                Audio Alert Pesanan
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                  audioEnabled
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-red-500/20 text-red-300"
                }`}
              >
                {audioEnabled ? "Aktif" : "Mati"}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-white/65">
              Bunyi lonceng otomatis saat ada pesanan web/QR meja baru masuk.
            </p>
          </div>
        </div>

        {/* Sidebar Footer: Shortcut Admin (jika Admin) & User Profile Card */}
        <div className="space-y-3 border-t border-white/10 p-3">
          {cashierUser.role === "ADMIN" ? (
            <Link
              href="/admin"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-white/20 active:scale-[0.99]"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-emerald-400" />
              <span>Buka Dashboard Admin</span>
              <ExternalLink className="h-3 w-3 text-white/50" />
            </Link>
          ) : (
            <Link
              href="/menu"
              target="_blank"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-white/20 active:scale-[0.99]"
            >
              <QrCode className="h-3.5 w-3.5 text-emerald-400" />
              <span>Lihat Katalog Pelanggan</span>
              <ExternalLink className="h-3 w-3 text-white/50" />
            </Link>
          )}

          {/* User Profile Card */}
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-white shadow-xs">
                {cashierUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{cashierUser.name}</p>
                <span className="rounded bg-primary/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-300">
                  {cashierUser.role === "ADMIN" ? "ADMIN (POS)" : "KASIR AKTIF"}
                </span>
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                title="Keluar Shift (Logout)"
                className="cursor-pointer rounded-lg p-1.5 text-white/60 transition-colors hover:bg-red-500/20 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Overlay Backdrop Mobile */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* =====================================================================
       * MAIN CONTENT AREA
       * =================================================================== */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* TOPBAR HEADER (Seragam dengan AdminDashboardShell) */}
        <header className="sticky top-0 z-30 flex flex-col justify-between gap-4 border-b border-border/80 bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-6 md:flex-row md:items-center lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-xl border border-border p-2 text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-base font-black tracking-tight text-foreground sm:text-lg">
                Shift Operasional Kasir — {cashierUser.name} 👋
              </h2>
              <p className="text-xs text-muted-foreground">
                Pantau antrean pesanan real-time, input POS manual, konfirmasi tunai, dan cetak
                struk termal.
              </p>
            </div>
          </div>

          {/* Quick Actions & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search bar mini */}
            <div className="relative hidden w-48 sm:block xl:w-60">
              <input
                type="text"
                placeholder="Cari no. order, pelanggan, meja..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-secondary-bg/50 pr-3 pl-8 text-xs outline-none focus:border-primary focus:bg-white"
              />
              <Search className=" absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            </div>

            {/* Toggle Notifikasi Suara (Audio Alert) */}
            <button
              type="button"
              onClick={() => {
                const next = !audioEnabled;
                setAudioEnabled(next);
                if (next) {
                  setTimeout(() => playAudioAlert(), 60);
                }
              }}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-2xs transition-all ${
                audioEnabled
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  : "border-neutral-300 bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
              title="Aktifkan/Matikan Notifikasi Suara Pesanan Masuk"
            >
              {audioEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-neutral-500" />
              )}
              <span>Suara: {audioEnabled ? "ON" : "OFF"}</span>
            </button>

            {/* Tombol Sinkronisasi Real-Time */}
            <button
              type="button"
              onClick={() => void refreshDashboardData()}
              disabled={isSyncing}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs transition hover:bg-secondary-bg disabled:opacity-60"
              title="Segarkan antrean sekarang (Auto-sync tiap 5 detik)"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-primary ${isSyncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Live Sync</span>
            </button>

            {/* Database indicator */}
            <span
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold ${
                dataSource === "database"
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                  : "border-amber-500/30 bg-amber-50 text-amber-800"
              }`}
            >
              <Database className="h-3 w-3" />
              <span>{dataSource === "database" ? "MySQL Aktif" : "Memori"}</span>
            </span>

            {/* Link ke Web Publik */}
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs hover:bg-secondary-bg"
            >
              <span>Web</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </Link>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Toast Notification */}
          {toast && (
            <div
              role="status"
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-bold shadow-xs ${
                toast.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900"
                  : toast.type === "info"
                    ? "border-primary/40 bg-primary/10 text-[#0E2A2E]"
                    : "border-red-500/40 bg-red-500/10 text-red-900"
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : toast.type === "info" ? (
                  <BellRing className="h-4 w-4 shrink-0 animate-bounce text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                )}
                <span>{toast.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Tutup notifikasi"
                className="rounded p-1 hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* 4 TOP STAT METRIC CARDS (Seragam dengan AdminDashboardShell) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Perlu Tindakan / Konfirmasi Tunai */}
            <div
              onClick={() => setActiveTab("queue")}
              className="cursor-pointer rounded-2xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">
                  Perlu Tindakan Kasir
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <BellRing className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-xl font-black tracking-tight text-foreground xl:text-2xl">
                {metrics.needActionCount}{" "}
                <span className="font-sans text-xs font-bold text-muted-foreground">
                  pesanan aktif
                </span>
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                <span>{metrics.unpaidCashCount} menunggu bayar tunai</span>
              </p>
            </div>

            {/* Card 2: Sedang Disiapkan & Siap Saji */}
            <div
              onClick={() => setActiveTab("queue")}
              className="cursor-pointer rounded-2xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">
                  Dapur &amp; Siap Saji
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <ChefHat className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-xl font-black tracking-tight text-foreground xl:text-2xl">
                {activeCookingAndReady}{" "}
                <span className="font-sans text-xs font-bold text-muted-foreground">
                  dalam proses
                </span>
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <span>
                  {metrics.preparingCount} dimasak • {metrics.readyCount} siap saji
                </span>
              </p>
            </div>

            {/* Card 3: Status Meja Dine-In */}
            <div
              onClick={() => setActiveTab("tables")}
              className="cursor-pointer rounded-2xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">
                  Status Meja Dine-In
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Utensils className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-xl font-black tracking-tight text-foreground xl:text-2xl">
                {metrics.occupiedTablesCount}{" "}
                <span className="font-sans text-xs font-bold text-muted-foreground">
                  / {metrics.totalActiveTablesCount} terisi
                </span>
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <span>
                  {Math.max(0, metrics.totalActiveTablesCount - metrics.occupiedTablesCount)} meja
                  kosong siap pakai
                </span>
              </p>
            </div>

            {/* Card 4: Penjualan Lunas Hari Ini */}
            <div
              onClick={() => setActiveTab("history")}
              className="cursor-pointer rounded-2xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">
                  Penerimaan Kasir Hari Ini
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-xl font-black tracking-tight text-foreground xl:text-2xl">
                {formatRupiah(metrics.todayRevenue)}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <span>
                  {metrics.paidOrdersCount} transaksi lunas dari {metrics.todayOrdersCount} order
                </span>
              </p>
            </div>
          </div>

          {/* KONTEN TAB AKTIF */}
          {activeTab === "queue" && (
            <CashierQueueTab
              orders={data.orders}
              searchQuery={searchQuery}
              onOpenCashModal={(ord) => setCashModalOrder(ord)}
              onOpenReceiptModal={(ord) => setReceiptModalOrder(ord)}
              onRefreshData={refreshDashboardData}
              onPlayAudioAlert={playAudioAlert}
              onNotify={notify}
            />
          )}

          {activeTab === "pos" && (
            <CashierPosTab
              categories={data.categories}
              products={data.products}
              tables={data.tables}
              settings={data.settings}
              preselectedTableNumber={preselectedPosTable}
              onClearPreselectedTable={() => setPreselectedPosTable(null)}
              onOrderCreated={async (createdOrder) => {
                await refreshDashboardData();
                setReceiptModalOrder(createdOrder);
              }}
              onNotify={notify}
            />
          )}

          {activeTab === "tables" && (
            <CashierTablesTab
              tables={data.tables}
              orders={data.orders}
              onCreatePosOrderAtTable={(tableNo) => {
                setPreselectedPosTable(tableNo);
                setActiveTab("pos");
              }}
              onOpenCashModal={(ord) => setCashModalOrder(ord)}
              onOpenReceiptModal={(ord) => setReceiptModalOrder(ord)}
              onRefreshData={refreshDashboardData}
              onNotify={notify}
            />
          )}

          {activeTab === "history" && (
            <CashierHistoryTab
              orders={data.orders}
              searchQuery={searchQuery}
              onOpenReceiptModal={(ord) => setReceiptModalOrder(ord)}
              onOpenCashModal={(ord) => setCashModalOrder(ord)}
            />
          )}

          {activeTab === "stock" && (
            <CashierStockTab
              categories={data.categories}
              products={data.products}
              searchQuery={searchQuery}
            />
          )}
        </main>
      </div>

      {/* =====================================================================
       * MODAL PEMBAYARAN TUNAI & KALKULASI KEMBALIAN
       * =================================================================== */}
      {cashModalOrder && (
        <CashierPaymentModal
          order={cashModalOrder}
          onClose={() => setCashModalOrder(null)}
          onPaidSuccess={async (updatedOrder, shouldPrintReceipt) => {
            setCashModalOrder(null);
            notify(
              `Pembayaran tunai ${updatedOrder.orderNumber} berhasil! Kembalian: ${formatRupiah(
                updatedOrder.payment.changeAmount,
              )}`,
              "success",
            );
            await refreshDashboardData();
            if (shouldPrintReceipt) {
              setReceiptModalOrder(updatedOrder);
            }
          }}
        />
      )}

      {/* =====================================================================
       * MODAL CETAK STRUK TERMAL 58MM / 80MM
       * =================================================================== */}
      {receiptModalOrder && (
        <CashierReceiptModal
          order={receiptModalOrder}
          settings={data.settings}
          cashierName={cashierUser.name}
          onClose={() => setReceiptModalOrder(null)}
        />
      )}
    </div>
  );
}

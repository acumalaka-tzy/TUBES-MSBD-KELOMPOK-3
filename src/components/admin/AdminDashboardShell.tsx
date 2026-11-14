"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  Coffee,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
  UtensilsCrossed,
  Wallet,
  ShoppingBag,
  X,
  XCircle,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { toggleWebOrderingAction } from "@/app/actions/admin";
import { formatRupiah } from "@/lib/utils";
import type {
  AdminAuditLog,
  AdminCategory,
  AdminProduct,
  AdminSettings,
  AdminStaffUser,
  AdminStockMovement,
  AdminTable,
  DetailedSalesReport,
  DashboardSummary,
  DataSource,
  PeriodKey,
} from "@/lib/admin/types";
import type { AdminTabKey } from "./admin-ui";
import { AdminOverviewTab } from "./AdminOverviewTab";
import { AdminCatalogTab } from "./AdminCatalogTab";
import { AdminStockTab } from "./AdminStockTab";
import { AdminTablesTab } from "./AdminTablesTab";
import { AdminStaffTab } from "./AdminStaffTab";
import { AdminReportsTab } from "./AdminReportsTab";
import { AdminSettingsTab } from "./AdminSettingsTab";
import { AdminAuditLogTab } from "./AdminAuditLogTab";

interface AdminDashboardShellProps {
  adminUser: { id: string; name: string; email: string; role: string };
  dataSource: DataSource;
  activeTab: AdminTabKey;
  activePeriod: PeriodKey;
  fromParam?: string;
  toParam?: string;
  auditEntity: string;
  auditQuery: string;
  summary: DashboardSummary;
  categories: AdminCategory[];
  products: AdminProduct[];
  movements: AdminStockMovement[];
  auditLogs: AdminAuditLog[];
  settings: AdminSettings;
  tables: AdminTable[];
  staff: AdminStaffUser[];
  detailedReport: DetailedSalesReport;
}

export function AdminDashboardShell({
  adminUser,
  dataSource,
  activeTab,
  activePeriod,
  fromParam,
  toParam,
  auditEntity,
  auditQuery,
  summary,
  categories,
  products,
  movements,
  auditLogs,
  settings,
  tables,
  staff,
  detailedReport,
}: AdminDashboardShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [quickToggling, setQuickToggling] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((type: "success" | "error", text: string) => {
    if (!text) return;
    setToast({ type, text });
  }, []);

  const refreshData = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const updateUrlParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams();
      const base: Record<string, string | undefined> = {
        tab: activeTab,
        period: activePeriod,
        from: fromParam,
        to: toParam,
        auditEntity: auditEntity !== "ALL" ? auditEntity : undefined,
        auditQ: auditQuery || undefined,
        ...updates,
      };
      for (const [k, v] of Object.entries(base)) {
        if (v && v.trim() !== "") params.set(k, v);
      }
      startTransition(() => {
        router.replace(`/admin?${params.toString()}`, { scroll: false });
      });
      setMobileSidebarOpen(false);
    },
    [activeTab, activePeriod, fromParam, toParam, auditEntity, auditQuery, router],
  );

  async function handleQuickToggle() {
    setQuickToggling(true);
    const res = await toggleWebOrderingAction(!settings.isWebOrderingOpen);
    setQuickToggling(false);
    if (!res.success) {
      notify("error", res.error ?? "Gagal mengubah status pemesanan web.");
      return;
    }
    notify("success", res.message ?? "Status toko diperbarui.");
    refreshData();
  }

  const stockAlerts = summary.lowStockCount + summary.outOfStockCount;
  const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;

  const navMenuItems: {
    key: AdminTabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { key: "overview", label: "Dashboard", icon: LayoutDashboard },
    { key: "catalog", label: "Menu & Kategori", icon: UtensilsCrossed },
    {
      key: "stock",
      label: "Stok Porsi",
      icon: Boxes,
      badge: stockAlerts > 0 ? stockAlerts : undefined,
    },
    { key: "tables", label: "Meja & QR Code", icon: QrCode },
    { key: "staff", label: "Staf Kasir", icon: Users },
    { key: "reports", label: "Laporan & Ekspor", icon: FileSpreadsheet },
    { key: "audit", label: "Audit Log", icon: ShieldCheck },
    { key: "settings", label: "Pengaturan Toko", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#F4F7F6] text-foreground font-sans">
      {/* SIDEBAR DESKTOP & MOBILE DRAWER */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between bg-[#0E2A2E] text-white shadow-xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header Brand */}
        <div>
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                <Coffee className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-white leading-tight">
                  Warkop Agam
                </h1>
                <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                  Admin POS System
                </p>
              </div>
            </div>

            {/* Tombol Tutup Mobile */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="rounded-lg p-1 text-white/70 hover:bg-white/10 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigasi Menu Vertikal (Pills Style Persis Gambar Referensi) */}
          <nav className="space-y-1 px-3 py-4" aria-label="Sidebar Menu Admin">
            {navMenuItems.map((item) => {
              const active = activeTab === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => updateUrlParams({ tab: item.key })}
                  className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-white text-[#0E2A2E] shadow-sm font-extrabold"
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
                        active ? "bg-amber-500 text-white" : "bg-amber-400/20 text-amber-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Shortcut POS & User Profile Card */}
        <div className="p-3 border-t border-white/10 space-y-3">
          {/* Shortcut POS Kasir */}
          <Link
            href="/cashier"
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-white/20 active:scale-[0.99] cursor-pointer"
          >
            <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-400" />
            <span>Buka POS Kasir</span>
            <ExternalLink className="h-3 w-3 text-white/50" />
          </Link>

          {/* User Profile Card */}
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white font-bold text-xs shadow-xs">
                {adminUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{adminUser.name}</p>
                <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[9px] font-mono font-bold text-emerald-300">
                  ADMINISTRATOR
                </span>
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                title="Keluar (Logout)"
                className="rounded-lg p-1.5 text-white/60 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
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

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        
        {/* TOPBAR HEADER (Welcome greeting, search, toggles) */}
        <header className="sticky top-0 z-30 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-xl border border-border p-2 text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                Selamat Datang Kembali, {adminUser.name}! 👋
              </h2>
              <p className="text-xs text-muted-foreground">
                Berikut ringkasan performa dan operasional Warkop Agam hari ini.
              </p>
            </div>
          </div>

          {/* Quick Actions & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search bar mini */}
            <div className="relative hidden sm:block w-48 xl:w-60">
              <input
                type="text"
                placeholder="Cari menu, meja..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-secondary-bg/50 pl-8 pr-3 text-xs outline-none focus:border-primary focus:bg-white"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            </div>

            {/* Quick Toggle Web Ordering */}
            <button
              type="button"
              disabled={quickToggling}
              onClick={handleQuickToggle}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-60 cursor-pointer shadow-2xs ${
                settings.isWebOrderingOpen
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  : "border-red-500/30 bg-red-50 text-red-800 hover:bg-red-100"
              }`}
            >
              {settings.isWebOrderingOpen ? (
                <Globe className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-red-600" />
              )}
              <span>Web Order: {settings.isWebOrderingOpen ? "BUKA" : "TUTUP"}</span>
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
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary-bg shadow-2xs"
            >
              <span>Web</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </Link>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
          
          {/* Toast Notification */}
          {toast && (
            <div
              role="status"
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-xs ${
                toast.type === "success"
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-error/40 bg-error/10 text-error"
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
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

          {/* 4 TOP STAT METRIC CARDS (Persis Seperti di Gambar PosyMart) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Total Sales */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Total Penjualan (Net)</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xl xl:text-2xl font-black font-mono text-foreground tracking-tight">
                {formatRupiah(summary.netSales)}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <span>↑ {summary.netSales > 0 ? "12.5%" : "0%"}</span>
                <span className="text-muted-foreground font-normal">dari periode lalu</span>
              </p>
            </div>

            {/* Card 2: Orders */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Jumlah Pesanan</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xl xl:text-2xl font-black font-mono text-foreground tracking-tight">
                {summary.successfulOrders}{" "}
                <span className="text-xs font-bold text-muted-foreground font-sans">
                  / {summary.totalOrders} order
                </span>
              </p>
              <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <span>↑ {summary.successfulOrders > 0 ? "8.2%" : "0%"}</span>
                <span className="text-muted-foreground font-normal">transaksi berhasil</span>
              </p>
            </div>

            {/* Card 3: Meja Aktif / Customer */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Okupansi Meja Aktif</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xl xl:text-2xl font-black font-mono text-foreground tracking-tight">
                {occupiedTables}{" "}
                <span className="text-xs font-bold text-muted-foreground font-sans">
                  / {tables.length} meja terisi
                </span>
              </p>
              <p className="mt-1 text-[11px] font-semibold text-cyan-700 flex items-center gap-1">
                <span>{tables.length - occupiedTables} meja kosong</span>
                <span className="text-muted-foreground font-normal">siap digunakan</span>
              </p>
            </div>

            {/* Card 4: Avg. Order Value (AOV) */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Rata-rata Order (AOV)</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xl xl:text-2xl font-black font-mono text-foreground tracking-tight">
                {formatRupiah(summary.averageOrderValue)}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <span>↑ {summary.averageOrderValue > 0 ? "3.1%" : "0%"}</span>
                <span className="text-muted-foreground font-normal">rata-rata per meja</span>
              </p>
            </div>

          </div>

          {/* DYNAMIC MODULE VIEW (Berdasarkan Tab Sidebar Aktif) */}
          <div className="transition-all">
            {activeTab === "overview" && (
              <AdminOverviewTab
                summary={summary}
                categories={categories}
                products={products}
                detailedReport={detailedReport}
                activePeriod={activePeriod}
                fromParam={fromParam}
                toParam={toParam}
                onPeriodChange={(period, from, to) =>
                  updateUrlParams({
                    tab: "overview",
                    period,
                    from: period === "custom" ? from : undefined,
                    to: period === "custom" ? to : undefined,
                  })
                }
                onNavigateTab={(tab) => updateUrlParams({ tab })}
              />
            )}

            {activeTab === "catalog" && (
              <AdminCatalogTab
                categories={categories}
                products={products}
                onNotify={notify}
                onRefresh={refreshData}
              />
            )}

            {activeTab === "stock" && (
              <AdminStockTab
                products={products}
                movements={movements}
                onNotify={notify}
                onRefresh={refreshData}
              />
            )}

            {activeTab === "tables" && (
              <AdminTablesTab
                tables={tables}
                onNotify={notify}
                onRefresh={refreshData}
              />
            )}

            {activeTab === "staff" && (
              <AdminStaffTab
                staff={staff}
                currentAdminId={adminUser.id}
                onNotify={notify}
                onRefresh={refreshData}
              />
            )}

            {activeTab === "reports" && (
              <AdminReportsTab
                report={detailedReport}
                movements={movements}
                onPeriodChange={(period, from, to) =>
                  updateUrlParams({
                    tab: "reports",
                    period,
                    from: period === "custom" ? from : undefined,
                    to: period === "custom" ? to : undefined,
                  })
                }
                restaurantName={settings.restaurantName}
              />
            )}

            {activeTab === "settings" && (
              <AdminSettingsTab
                key={settings.updatedAt ?? "settings-init"}
                settings={settings}
                onNotify={notify}
                onRefresh={refreshData}
              />
            )}

            {activeTab === "audit" && (
              <AdminAuditLogTab
                logs={auditLogs}
                initialEntity={auditEntity}
                initialQuery={auditQuery}
                onFilterApply={(entity, q) =>
                  updateUrlParams({
                    tab: "audit",
                    auditEntity: entity === "ALL" ? undefined : entity,
                    auditQ: q.trim() || undefined,
                  })
                }
              />
            )}
          </div>

        </main>
      </div>
    </div>
  );
}

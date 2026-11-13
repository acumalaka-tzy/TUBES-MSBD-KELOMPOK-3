"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe,
  Lock,
  LogOut,
  Settings,
  ShieldCheck,
  UtensilsCrossed,
  X,
  XCircle,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { toggleWebOrderingAction } from "@/app/actions/admin";
import type {
  AdminAuditLog,
  AdminCategory,
  AdminProduct,
  AdminSettings,
  AdminStockMovement,
  DashboardSummary,
  DataSource,
  PeriodKey,
} from "@/lib/admin/types";
import type { AdminTabKey } from "./admin-ui";
import { AdminOverviewTab } from "./AdminOverviewTab";
import { AdminCatalogTab } from "./AdminCatalogTab";
import { AdminStockTab } from "./AdminStockTab";
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
}: AdminDashboardShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [quickToggling, setQuickToggling] = useState(false);

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

  const tabs: {
    key: AdminTabKey;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { key: "overview", label: "Ringkasan & Analitik", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "catalog", label: "Menu, Kategori & Varian", icon: <UtensilsCrossed className="h-4 w-4" /> },
    {
      key: "stock",
      label: "Stok Porsi",
      icon: <Boxes className="h-4 w-4" />,
      badge: stockAlerts > 0 ? stockAlerts : undefined,
    },
    { key: "settings", label: "Toko & Pajak", icon: <Settings className="h-4 w-4" /> },
    { key: "audit", label: "Audit Log", icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-secondary-bg/40 pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-white shadow-xs">
              WA
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold text-foreground">
                  Dashboard Admin · {settings.restaurantName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    dataSource === "database"
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-warning/40 bg-warning/15 text-amber-800"
                  }`}
                >
                  <Database className="h-3 w-3" />
                  {dataSource === "database" ? "MySQL Aktif" : "Mode Memori"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Login terverifikasi sebagai{" "}
                <span className="font-semibold text-foreground">{adminUser.name}</span> (
                {adminUser.email})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Master Toggle Quick Button */}
            <button
              type="button"
              disabled={quickToggling}
              onClick={handleQuickToggle}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
                settings.isWebOrderingOpen
                  ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
                  : "border-error/40 bg-error/10 text-error hover:bg-error/20"
              }`}
            >
              {settings.isWebOrderingOpen ? (
                <Globe className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              Web Order: {settings.isWebOrderingOpen ? "BUKA" : "TUTUP"}
            </button>

            <Link
              href="/menu"
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary-bg"
            >
              Katalog
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/cashier"
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary-bg"
            >
              Kasir
              <ExternalLink className="h-3 w-3" />
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl border border-error/30 bg-background px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Keluar
              </button>
            </form>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="no-scrollbar flex gap-1 overflow-x-auto pb-2" aria-label="Menu Admin">
            {tabs.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => updateUrlParams({ tab: t.key })}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                    active
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted-foreground hover:bg-secondary-bg hover:text-foreground"
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {t.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? "bg-white/25 text-white" : "bg-warning/20 text-amber-800"
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
            {isPending && (
              <span className="ml-auto self-center px-2 text-[11px] font-medium text-muted-foreground">
                Memuat...
              </span>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        {toast && (
          <div
            role="status"
            className={`mb-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-xs ${
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

        {activeTab === "overview" && (
          <AdminOverviewTab
            summary={summary}
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
      </main>
    </div>
  );
}

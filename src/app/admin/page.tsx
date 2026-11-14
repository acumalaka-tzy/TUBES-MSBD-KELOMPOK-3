import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/user-service";
import {
  getAdminSettings,
  getDashboardSummary,
  getDataSource,
  getDetailedSalesReport,
  listAdminCategories,
  listAdminProducts,
  listAdminStaff,
  listAdminTables,
  listAuditLogs,
  listStockMovements,
} from "@/lib/admin/queries";
import type { PeriodKey } from "@/lib/admin/types";
import type { AdminTabKey } from "@/components/admin/admin-ui";
import { AdminDashboardShell } from "@/components/admin/AdminDashboardShell";

const VALID_TABS: AdminTabKey[] = [
  "overview",
  "catalog",
  "stock",
  "tables",
  "staff",
  "reports",
  "settings",
  "audit",
];
const VALID_PERIODS: PeriodKey[] = ["today", "7d", "month", "custom"];

function pickFirst(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}

async function AdminDashboardContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login?redirect=/admin");
  }
  if (session.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const dbUser = await getUserById(session.sub);
  if (dbUser && !dbUser.isActive) {
    redirect("/unauthorized");
  }

  const rawParams = await searchParamsPromise;
  const rawTab = pickFirst(rawParams.tab);
  const activeTab: AdminTabKey = VALID_TABS.includes(rawTab as AdminTabKey)
    ? (rawTab as AdminTabKey)
    : "overview";

  const rawPeriod = pickFirst(rawParams.period);
  const activePeriod: PeriodKey = VALID_PERIODS.includes(rawPeriod as PeriodKey)
    ? (rawPeriod as PeriodKey)
    : "7d";

  const fromParam = pickFirst(rawParams.from);
  const toParam = pickFirst(rawParams.to);
  const auditEntity = pickFirst(rawParams.auditEntity) ?? "ALL";
  const auditQuery = pickFirst(rawParams.auditQ) ?? "";

  const [
    dataSource,
    summaryRes,
    categoriesRes,
    productsRes,
    movementsRes,
    auditRes,
    settingsRes,
    tablesRes,
    staffRes,
    detailedReportRes,
  ] = await Promise.all([
    getDataSource(),
    getDashboardSummary(activePeriod, fromParam, toParam),
    listAdminCategories(),
    listAdminProducts(),
    listStockMovements(80),
    listAuditLogs({
      entity: auditEntity === "ALL" ? undefined : auditEntity,
      q: auditQuery || undefined,
      limit: 150,
    }),
    getAdminSettings(),
    listAdminTables(),
    listAdminStaff(),
    getDetailedSalesReport(activePeriod, fromParam, toParam),
  ]);

  return (
    <AdminDashboardShell
      adminUser={{
        id: session.sub,
        name: session.name,
        email: session.email ?? session.phone,
        role: session.role,
      }}
      dataSource={dataSource}
      activeTab={activeTab}
      activePeriod={activePeriod}
      fromParam={fromParam}
      toParam={toParam}
      auditEntity={auditEntity}
      auditQuery={auditQuery}
      summary={summaryRes.data}
      categories={categoriesRes.data}
      products={productsRes.data}
      movements={movementsRes.data}
      auditLogs={auditRes.data}
      settings={settingsRes.data}
      tables={tablesRes.data}
      staff={staffRes.data}
      detailedReport={detailedReportRes.data}
    />
  );
}

function AdminDashboardFallback() {
  return (
    <div className="min-h-screen bg-secondary-bg/40 p-6">
      <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
        <div className="h-16 rounded-2xl border border-border bg-background" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-28 rounded-2xl border border-border bg-background" />
          <div className="h-28 rounded-2xl border border-border bg-background" />
          <div className="h-28 rounded-2xl border border-border bg-background" />
          <div className="h-28 rounded-2xl border border-border bg-background" />
        </div>
        <div className="h-72 rounded-2xl border border-border bg-background" />
      </div>
    </div>
  );
}

export default function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<AdminDashboardFallback />}>
      <AdminDashboardContent searchParamsPromise={searchParams} />
    </Suspense>
  );
}

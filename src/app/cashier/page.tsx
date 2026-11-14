import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/user-service";
import { getCashierDashboardData } from "@/app/actions/cashier";
import { CashierDashboardShell } from "@/components/cashier/CashierDashboardShell";

async function CashierDashboardContent() {
  const session = await getSession();

  // Defense in depth server-side RBAC check
  if (!session) {
    redirect("/login?redirect=/cashier");
  }
  if (session.role !== "CASHIER" && session.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const dbUser = await getUserById(session.sub);
  if (dbUser && !dbUser.isActive) {
    redirect("/unauthorized");
  }

  const initialData = await getCashierDashboardData();

  return (
    <CashierDashboardShell
      cashierUser={{
        id: session.sub,
        name: session.name,
        phone: session.phone,
        role: session.role,
      }}
      initialData={initialData}
    />
  );
}

function CashierDashboardFallback() {
  return (
    <div className="min-h-screen bg-[#F4F7F6] p-6">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-16 rounded-2xl border border-border bg-white" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-28 rounded-2xl border border-border bg-white" />
          <div className="h-28 rounded-2xl border border-border bg-white" />
          <div className="h-28 rounded-2xl border border-border bg-white" />
          <div className="h-28 rounded-2xl border border-border bg-white" />
        </div>
        <div className="h-96 rounded-2xl border border-border bg-white" />
      </div>
    </div>
  );
}

export default function CashierDashboardPage() {
  return (
    <Suspense fallback={<CashierDashboardFallback />}>
      <CashierDashboardContent />
    </Suspense>
  );
}

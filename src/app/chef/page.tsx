import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/user-service";
import { getActiveKitchenQueueAction } from "@/app/actions/chef";
import { ChefDashboardView } from "@/components/chef/ChefDashboardView";

export const metadata = {
  title: "Kitchen Display System (KDS) - Warkop Agam",
  description: "Antrean Dapur Real-time terintegrasi View Database vw_active_kitchen_queue",
};

export default async function ChefPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/chef");
  }

  if (session.role !== "CHEF" && session.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const dbUser = await getUserById(session.sub);
  if (dbUser && !dbUser.isActive) {
    redirect("/unauthorized");
  }

  const queue = await getActiveKitchenQueueAction();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F172A] p-6 text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
        </div>
      }
    >
      <ChefDashboardView initialQueue={queue} chefName={session.name} />
    </Suspense>
  );
}

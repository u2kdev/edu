import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import PlatformAdminManager from "@/components/PlatformAdminManager";

export default async function PlatformAdminPage() {
  const session = await getAuthSession();
  if (!session || session.user.platformRole === "NONE") {
    redirect("/dashboard");
  }

  const centers = await db.learningCenter.findMany({
    include: {
      owner: { select: { fullName: true, email: true } },
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
      memberships: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const plans = await db.subscriptionPlan.findMany({
    orderBy: { priceMonthly: "asc" },
  });

  const totalCenters = centers.length;
  const activeCenters = centers.filter((c) => c.status === "ACTIVE").length;
  const frozenCenters = centers.filter((c) => c.status === "FROZEN").length;

  return (
    <div className="space-y-6">
      <div>
        <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold uppercase tracking-wider rounded-full">
          Блок SaaS / Суперменеджер платформы
        </span>
        <h1 className="text-2xl font-bold text-white mt-2">Обзор учебных центров</h1>
        <p className="text-sm text-slate-400 mt-1">
          Управление всеми зарегистрированными учебными центрами, планами подписок и биллингом
        </p>
      </div>

      <PlatformAdminManager
        initialCenters={centers}
        plans={plans}
        metrics={{ totalCenters, activeCenters, frozenCenters }}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
// Reason: Exception: SubscriptionPlan and SupportTicket upgrade requests are platform-level models scoped to centerId.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { getCenterPlanFeatures, parsePlanFeatures } from "@/lib/plan-features";
import UpgradePlansClient from "@/components/UpgradePlansClient";

export const dynamic = "force-dynamic";

export default async function CenterUpgradePage() {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const actorRole = tenantCtx.role;
  const canView =
    tenantCtx.isPlatformStaff ||
    ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"].includes(actorRole || "");

  if (!canView) {
    redirect("/center");
  }

  const canRequest =
    !tenantCtx.isImpersonating &&
    !session.impersonatorUserId &&
    ["DIRECTOR", "CENTER_ADMIN"].includes(actorRole || "");

  const [currentPlan, rawPlans, rawTickets] = await Promise.all([
    getCenterPlanFeatures(tenantCtx.center.id),
    db.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: "asc" },
    }),
    db.supportTicket.findMany({
      where: {
        centerId: tenantCtx.center.id,
        scope: "PLATFORM",
        subject: { startsWith: "Запрос на смену тарифа" },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <UpgradePlansClient
      currentPlanId={currentPlan.planId}
      currentPlanName={currentPlan.planName}
      subscriptionStatus={currentPlan.subscriptionStatus}
      plans={rawPlans.map((p) => ({
        id: p.id,
        name: p.name,
        priceMonthly: p.priceMonthly,
        maxStudents: p.maxStudents,
        maxTeachers: p.maxTeachers,
        maxCourses: p.maxCourses,
        maxBranches: p.maxBranches,
        maxStorage: p.maxStorage,
        features: parsePlanFeatures(p.featuresJson),
      }))}
      initialRequests={rawTickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt.toISOString(),
      }))}
      canRequest={canRequest}
      locale={session.user.preferredLanguage}
    />
  );
}

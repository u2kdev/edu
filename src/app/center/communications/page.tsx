import { redirect } from "next/navigation";
import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getCenterPlanFeatures } from "@/lib/plan-features";
import CommunicationsManager from "@/components/communications/CommunicationsManager";

export const dynamic = "force-dynamic";

export default async function CenterCommunicationsPage() {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const actorRole = tenantCtx.role;
  const canRead =
    tenantCtx.isPlatformStaff ||
    hasPermission("announcements.manage", session.user.platformRole, actorRole) ||
    hasPermission("settings.manage", session.user.platformRole, actorRole);

  if (!canRead) {
    redirect("/center");
  }

  const canWrite =
    !tenantCtx.isImpersonating &&
    !session.impersonatorUserId &&
    hasPermission("announcements.manage", "NONE", actorRole);

  const centerId = tenantCtx.center.id;
  const tenantDb = tenantCtx.getTenantDb();

  const [rawBroadcasts, totalBroadcasts, rawTemplates, groups, planCtx] = await Promise.all([
    tenantDb.broadcast.findMany({
      where: { centerId },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    tenantDb.broadcast.count({ where: { centerId } }),
    tenantDb.communicationTemplate.findMany({
      where: { centerId },
      orderBy: [{ key: "asc" }, { locale: "asc" }],
    }),
    tenantDb.group.findMany({
      where: { course: { centerId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getCenterPlanFeatures(centerId),
  ]);

  return (
    <CommunicationsManager
      initialBroadcasts={rawBroadcasts.map((b) => ({
        id: b.id,
        title: b.title,
        bodyRu: b.bodyRu,
        bodyUz: b.bodyUz,
        channel: b.channel,
        audience: b.audience,
        targetGroupId: b.targetGroupId,
        targetRole: b.targetRole,
        status: b.status,
        scheduledAt: b.scheduledAt ? b.scheduledAt.toISOString() : null,
        startedAt: b.startedAt ? b.startedAt.toISOString() : null,
        completedAt: b.completedAt ? b.completedAt.toISOString() : null,
        totalRecipients: b.totalRecipients,
        sentCount: b.sentCount,
        failedCount: b.failedCount,
        estimatedCost: b.estimatedCost,
        createdAt: b.createdAt.toISOString(),
        createdBy: b.createdBy,
        group: b.group,
      }))}
      initialTotal={totalBroadcasts}
      initialTemplates={rawTemplates.map((tpl) => ({
        id: tpl.id,
        key: tpl.key,
        locale: tpl.locale,
        title: tpl.title,
        body: tpl.body,
        isActive: tpl.isActive,
        updatedAt: tpl.updatedAt.toISOString(),
      }))}
      groups={groups}
      planFeatures={{
        broadcasts: planCtx.features.broadcasts,
        smsReminders: planCtx.features.smsReminders,
        telegramBot: planCtx.features.telegramBot,
        mobileApp: planCtx.features.mobileApp,
      }}
      planName={planCtx.planName}
      canWrite={canWrite}
      locale={session.user.preferredLanguage}
    />
  );
}

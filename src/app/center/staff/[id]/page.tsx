import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
// Reason: Exception: Server page checks session models and shared rules.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { canManageUserAccount } from "@/lib/tenant-user-guard";
import { StaffProfileClient } from "@/components/staff/StaffProfileClient";

export default async function StaffMemberProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const actorRole = session.activeCenterRole || "";
  const locale = session.user.preferredLanguage || "ru";

  if (actorRole !== "DIRECTOR" && actorRole !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
    redirect("/center/staff");
  }

  const tenantDb = tenantCtx.getTenantDb();
  const membershipId = params.id;

  const membership = await tenantDb.centerMembership.findFirst({
    where: {
      centerId: tenantCtx.center.id,
      OR: [
        { id: membershipId },
        { userId: membershipId },
      ],
    },
    include: {
      user: true,
      taughtGroups: {
        select: { id: true, name: true },
      },
      assistedGroups: {
        select: { id: true, name: true },
      },
    },
  });

  if (!membership) {
    redirect("/center/staff");
  }

  // Manageability / shared rule
  const manageability = await canManageUserAccount(tenantCtx.center.id, membership.user.id);

  // Active sessions for this user
  const activeSessions = await db.userSession.findMany({
    where: {
      userId: membership.user.id,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
      lastSeenAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Center audit logs for this member
  const auditLogs = await tenantDb.auditLog.findMany({
    where: {
      centerId: tenantCtx.center.id,
      OR: [
        { resourceId: membership.id },
        { resourceId: membership.user.id },
        { actorUserId: membership.user.id },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      action: true,
      createdAt: true,
      detailsJson: true,
    },
  });

  const isSyntheticEmail = membership.user.email.endsWith("@noemail.local");

  const combinedGroups = [
    ...(membership.taughtGroups || []),
    ...(membership.assistedGroups || []),
  ];

  return (
    <StaffProfileClient
      membership={{
        id: membership.id,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt.toISOString(),
      }}
      user={{
        id: membership.user.id,
        fullName: membership.user.fullName,
        email: isSyntheticEmail ? null : membership.user.email,
        phone: membership.user.phone,
        username: membership.user.username,
        avatarUrl: membership.user.avatarUrl,
        preferredLanguage: membership.user.preferredLanguage,
        lastLoginAt: membership.user.lastLoginAt ? membership.user.lastLoginAt.toISOString() : null,
        createdAt: membership.user.createdAt.toISOString(),
      }}
      groups={combinedGroups}
      activeSessions={activeSessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastUsedAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null,
      }))}
      auditLogs={auditLogs.map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.createdAt.toISOString(),
        actorRole: null,
        details: a.detailsJson ? JSON.parse(a.detailsJson) : null,
      }))}
      manageability={{
        canManage: manageability.canManage,
        isShared: manageability.isShared,
        reason: manageability.reason,
      }}
      actorRole={actorRole}
      locale={locale}
    />
  );
}

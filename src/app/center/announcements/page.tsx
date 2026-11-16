import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AnnouncementsManager from "@/components/AnnouncementsManager";
import { isCenterRole } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

export default async function AnnouncementsPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const activeRole = session.activeCenterRole || "";

  const now = new Date();

  // Role-scoped query
  const whereCondition: Prisma.AnnouncementWhereInput = {
    centerId,
    publishAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
  };

  if (activeRole !== "DIRECTOR" && activeRole !== "CENTER_ADMIN") {
    const roleOr: Prisma.AnnouncementWhereInput[] = [{ targetRole: null }];
    if (isCenterRole(activeRole)) {
      roleOr.push({ targetRole: activeRole });
    }
    whereCondition.AND = [{ OR: roleOr }];
  }

  const [announcements, groups] = await Promise.all([
    tenantCtx.getTenantDb().announcement.findMany({
      where: whereCondition,
      include: {
        author: { include: { user: { select: { fullName: true } } } },
        group: { select: { id: true, name: true } },
      },
      orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }],
      take: 50,
    }),
    tenantCtx.getTenantDb().group.findMany({
      where: {
        centerId,
        ...(activeRole === "TEACHER" && tenantCtx.membership
          ? { teacherMembershipId: tenantCtx.membership.id }
          : activeRole === "TEACHER_ASSISTANT" && tenantCtx.membership
          ? { assistantMembershipId: tenantCtx.membership.id }
          : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canManage =
    activeRole === "DIRECTOR" ||
    activeRole === "CENTER_ADMIN" ||
    activeRole === "TEACHER" ||
    activeRole === "TEACHER_ASSISTANT" ||
    tenantCtx.isPlatformStaff;

  return (
    <AnnouncementsManager
      initialAnnouncements={announcements.map((a) => ({
        ...a,
        publishAt:
          typeof a.publishAt === "string"
            ? a.publishAt
            : a.publishAt?.toISOString?.() || new Date().toISOString(),
        expiresAt: a.expiresAt
          ? typeof a.expiresAt === "string"
            ? a.expiresAt
            : a.expiresAt.toISOString()
          : null,
        createdAt:
          typeof a.createdAt === "string"
            ? a.createdAt
            : a.createdAt?.toISOString?.() || new Date().toISOString(),
      }))}
      groups={groups}
      canManage={canManage}
      locale={locale}
    />
  );
}

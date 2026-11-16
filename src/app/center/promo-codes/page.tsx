import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { getCenterPlanFeatures } from "@/lib/plan-features";
import PromoCodesManager from "@/components/finance/PromoCodesManager";

export const dynamic = "force-dynamic";

export default async function CenterPromoCodesPage() {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const activeRole = tenantCtx.role;
  const platformRole = session.user.platformRole;
  const canRead =
    tenantCtx.isPlatformStaff ||
    hasPermission("payments.manage", platformRole, activeRole) ||
    hasPermission("finance.read", platformRole, activeRole);

  if (!canRead || !["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"].includes(activeRole || "") && !tenantCtx.isPlatformStaff) {
    redirect("/center");
  }

  const canManage =
    !tenantCtx.isImpersonating &&
    (tenantCtx.isPlatformStaff ||
      hasPermission("payments.manage", platformRole, activeRole));

  const tenantDb = tenantCtx.getTenantDb();
  const centerId = tenantCtx.center.id;

  const [rawPromoCodes, total, rawCourses, rawGroups, planCtx] = await Promise.all([
    tenantDb.promoCode.findMany({
      where: { centerId },
      include: {
        applicableCourse: { select: { id: true, title: true } },
        applicableGroup: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    tenantDb.promoCode.count({ where: { centerId } }),
    tenantDb.course.findMany({
      where: { centerId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    tenantDb.group.findMany({
      where: { centerId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getCenterPlanFeatures(centerId),
  ]);
  const promoLocked = !planCtx.features.promoCodes;

  return (
    <PromoCodesManager
      initialPromoCodes={rawPromoCodes.map((p) => ({
        id: p.id,
        code: p.code,
        discountType: p.discountType,
        value: p.value,
        validFrom: p.validFrom ? p.validFrom.toISOString() : null,
        validUntil: p.validUntil ? p.validUntil.toISOString() : null,
        maxUses: p.maxUses,
        usesCount: p.usesCount,
        isActive: p.isActive,
        applicableCourse: p.applicableCourse,
        applicableGroup: p.applicableGroup,
        createdAt: p.createdAt.toISOString(),
      }))}
      initialTotal={total}
      courses={rawCourses.map((c) => ({ id: c.id, label: c.title }))}
      groups={rawGroups.map((g) => ({ id: g.id, label: g.name }))}
      canManage={canManage && !promoLocked}
      featureLocked={promoLocked}
      locale={session.user.preferredLanguage}
    />
  );
}

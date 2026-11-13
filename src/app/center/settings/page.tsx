import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { CenterSettingsManager } from "@/components/settings/CenterSettingsManager";

export default async function CenterSettingsPage() {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage;
  const centerId = tenantCtx.center.id;

  const center = await tenantCtx.getTenantDb().learningCenter.findUnique({
    where: { id: centerId },
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!center) redirect("/login");

  const userMembership = session.memberships.find((m) => m.centerId === centerId);
  const activeRole = userMembership?.role || "STUDENT";
  const canManage = hasPermission("settings.manage", session.user.platformRole, activeRole);

  const formattedCenter = {
    id: center.id,
    name: center.name,
    slug: center.slug,
    organizationKind: center.organizationKind,
    centerType: center.centerType,
    status: center.status,
    address: center.address,
    phone: center.phone,
    email: center.email,
    inn: center.inn,
    legalName: center.legalName,
    contactPerson: center.contactPerson,
    logoUrl: center.logoUrl,
    brandingConfig: center.brandingConfig,
    defaultLanguage: center.defaultLanguage as "ru" | "uz-Latn" | "uz-Cyrl",
    timeZone: center.timeZone,
    gradingScale: center.gradingScale as "PERCENT_100" | "POINTS_5" | "PASS_FAIL",
    createdAt: center.createdAt.toISOString(),
    subscription: center.subscriptions[0]
      ? {
          status: center.subscriptions[0].status,
          planName: center.subscriptions[0].plan.name,
          currentPeriodEndsAt: center.subscriptions[0].currentPeriodEndsAt?.toISOString() || null,
          trialEndsAt: center.subscriptions[0].trialEndsAt?.toISOString() || null,
        }
      : null,
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-5xl">
      <CenterSettingsManager
        initialCenter={formattedCenter}
        locale={locale}
        canManage={canManage}
      />
    </div>
  );
}

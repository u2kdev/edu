export const dynamic = "force-dynamic";

import { requireTenantPageAccess, TenantSuspendedError } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { Building2 } from "lucide-react";
import CenterSuspendedPage from "./suspended/page";
import { PanelThemeProvider } from "@/components/theme/PanelThemeProvider";
import { AppShell } from "@/components/shell/AppShell";
import { getServerPanelTheme } from "@/lib/panel-theme";
import { getServerSidebarCollapsed, PARENT_CHILD_COOKIE } from "@/lib/sidebar-state";
import { getCenterPlanFeatures, type PlanFeatures } from "@/lib/plan-features";
import type { ParentChildOption } from "@/components/shell/ParentChildHeaderSwitcher";
import { t } from "@/i18n";

export default async function CenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check the session BEFORE tenant access: unauthenticated visitors must be
  // redirected to /login instead of crashing the layout with a 500.
  const session = await getAuthSession();
  if (!session) redirect("/login");

  if (session.user.mustChangePassword) {
    redirect("/account/change-password");
  }

  const locale = session.user.preferredLanguage;
  const [{ theme, resolvedTheme }, initialSidebarCollapsed] = await Promise.all([
    getServerPanelTheme(),
    Promise.resolve(getServerSidebarCollapsed()),
  ]);

  // Platform-level users without center membership should go to platform admin
  const platformOnlyRoles = ["SEO_ADMIN", "DEVELOPER"];
  if (
    platformOnlyRoles.includes(session.user.platformRole) &&
    session.memberships.length === 0
  ) {
    redirect("/platform-admin");
  }

  // If user has no center memberships, show a message
  if (!session.activeCenterId || session.memberships.length === 0) {
    return (
      <PanelThemeProvider initialTheme={theme} initialResolvedTheme={resolvedTheme}>
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <div className="bg-card p-8 rounded-lg border border-border text-center max-w-md w-full">
            <Building2 className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              {t(locale, "dashboard.selectCenter")}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t(locale, "student.useInviteCode")}
            </p>
            <Link
              href="/onboarding"
              className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium rounded-lg transition-colors inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t(locale, "landing.enterInviteCode")}
            </Link>
          </div>
        </div>
      </PanelThemeProvider>
    );
  }

  let tenantCtx;
  let isSuspended = false;

  try {
    tenantCtx = await requireTenantPageAccess({ allowSuspended: true });
  } catch (err) {
    if (err instanceof TenantSuspendedError) {
      isSuspended = true;
    } else {
      throw err;
    }
  }

  const activeRole = session.activeCenterRole || "";
  const isDirector = activeRole === "DIRECTOR";

  if (isSuspended) {
    return <CenterSuspendedPage />;
  }

  const tenantDb = tenantCtx!.getTenantDb();

  // Load center data (preserve exact query signature for tenant assertions)
  const center = await tenantDb.learningCenter.findUnique({
    where: { id: session.activeCenterId },
  });

  if (!center) redirect("/login");

  const isBlockedOrCancelled =
    center.status === "BLOCKED" || center.status === "CANCELLED";
  const isOverdueOrPaused =
    center.status === "OVERDUE" || center.status === "PAUSED";

  if (isBlockedOrCancelled || (isOverdueOrPaused && !isDirector)) {
    return <CenterSuspendedPage />;
  }

  // Load unread notification count for the notification bell
  const unreadNotifCount = await tenantDb.notification.count({
    where: {
      userId: session.user.id,
      isRead: false,
      OR: session.activeCenterId
        ? [{ centerId: session.activeCenterId }, { centerId: null }]
        : [{ centerId: null }],
    },
  });

  // Load plan entitlement flags safely for navigation visibility
  let planFeatures: PlanFeatures | undefined = undefined;
  try {
    const planCtx = await getCenterPlanFeatures(center.id);
    planFeatures = planCtx.features;
  } catch {
    planFeatures = undefined;
  }

  // Load granular membership permissions override if available
  const currentMembership = session.memberships.find(
    (m) => m.centerId === session.activeCenterId
  );
  let membershipPermissions: string | null = null;
  if (currentMembership?.id && tenantDb.centerMembership?.findUnique) {
    try {
      const memRow = await tenantDb.centerMembership.findUnique({
        where: { id: currentMembership.id },
        select: { permissions: true },
      });
      membershipPermissions = memRow?.permissions ?? null;
    } catch {
      membershipPermissions = null;
    }
  }

  // Load confirmed children for PARENT top-bar switcher
  let parentChildren: ParentChildOption[] = [];
  let selectedParentChildId: string | null = null;
  if (activeRole === "PARENT" && currentMembership?.id && tenantDb.parentLink?.findMany) {
    try {
      const rawLinks = await tenantDb.parentLink.findMany({
        where: {
          parentMembershipId: currentMembership.id,
          status: "CONFIRMED",
        },
        include: {
          student: {
            select: {
              id: true,
              user: { select: { fullName: true } },
            },
          },
        },
      });
      parentChildren = rawLinks
        .filter((link) => Boolean(link.student?.id))
        .map((link) => ({
          studentMembershipId: link.student.id,
          fullName: link.student.user?.fullName || link.student.id,
        }));

      try {
        const cookieChild = cookies().get(PARENT_CHILD_COOKIE)?.value;
        if (
          cookieChild &&
          parentChildren.some((child) => child.studentMembershipId === cookieChild)
        ) {
          selectedParentChildId = cookieChild;
        }
      } catch {
        selectedParentChildId = null;
      }
    } catch {
      parentChildren = [];
    }
  }

  let isImpersonatingCookie = false;
  try {
    isImpersonatingCookie = Boolean(
      cookies().get("platform_impersonation_original")?.value
    );
  } catch {}
  const isImpersonating = Boolean(
    session.impersonatorUserId || isImpersonatingCookie
  );
  const isSupportReadOnly =
    Boolean(session.isReadOnly) ||
    session.user.platformRole === "PLATFORM_SUPPORT";

  return (
    <PanelThemeProvider initialTheme={theme} initialResolvedTheme={resolvedTheme}>
      <AppShell
        scope="center"
        locale={locale}
        initialSidebarCollapsed={initialSidebarCollapsed}
        unreadNotificationsCount={unreadNotifCount}
        user={{
          fullName: session.user.fullName,
          email: session.user.email,
          avatarUrl: session.user.avatarUrl,
          platformRole: session.user.platformRole,
          centerRole: activeRole,
        }}
        navContext={{
          scope: "center",
          platformRole: session.user.platformRole,
          centerRole: activeRole,
          membershipPermissions,
          planFeatures,
          centerStatus: center.status,
        }}
        center={{
          id: center.id,
          name: center.name,
          logoUrl: center.logoUrl,
          status: center.status,
        }}
        memberships={session.memberships}
        parentChildren={parentChildren}
        selectedParentChildId={selectedParentChildId}
        impersonation={
          isImpersonating
            ? {
                active: true,
                role: session.activeCenterRole || tenantCtx?.role || "MEMBER",
                centerName: center.name,
                isReadOnly: Boolean(session.isReadOnly),
              }
            : null
        }
        readOnlyMode={
          (isOverdueOrPaused && isDirector) || isSupportReadOnly
            ? {
                active: true,
                isSuspendedCenterNotice: isOverdueOrPaused && isDirector,
              }
            : null
        }
        showPlatformAdminShortcut={session.user.platformRole !== "NONE"}
      >
        {children}
      </AppShell>
    </PanelThemeProvider>
  );
}

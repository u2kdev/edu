export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getAuthSession } from "@/lib/auth";
// Reason: Exception: Unified /account layout resolves user's shell context across platform, developer, and active center scopes.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { PanelThemeProvider } from "@/components/theme/PanelThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AppShell } from "@/components/shell/AppShell";
import { getServerPanelTheme } from "@/lib/panel-theme";
import { getServerSidebarCollapsed, PARENT_CHILD_COOKIE } from "@/lib/sidebar-state";
import { getCenterPlanFeatures, type PlanFeatures } from "@/lib/plan-features";
import type { ParentChildOption } from "@/components/shell/ParentChildHeaderSwitcher";
import { t } from "@/i18n";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage || "ru";
  const [{ theme, resolvedTheme }, initialSidebarCollapsed] = await Promise.all([
    getServerPanelTheme(),
    Promise.resolve(getServerSidebarCollapsed()),
  ]);

  // Forced password change routes keep isolated minimal chrome
  if (session.user.mustChangePassword) {
    return (
      <PanelThemeProvider initialTheme={theme} initialResolvedTheme={resolvedTheme}>
        {children}
      </PanelThemeProvider>
    );
  }

  let isImpersonatingCookie = false;
  try {
    isImpersonatingCookie = Boolean(cookies().get("platform_impersonation_original")?.value);
  } catch {}
  const isImpersonating = Boolean(session.impersonatorUserId || isImpersonatingCookie);

  const platformRole = session.user.platformRole || "NONE";
  const isPlatformOnly =
    ["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT", "SEO_ADMIN", "DEVELOPER"].includes(
      platformRole
    ) && !session.activeCenterId;

  let unreadNotifCount = 0;
  try {
    unreadNotifCount = await db.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
        ...(session.activeCenterId
          ? { OR: [{ centerId: session.activeCenterId }, { centerId: null }] }
          : {}),
      },
    });
  } catch {
    unreadNotifCount = 0;
  }

  if (isPlatformOnly || (platformRole === "DEVELOPER" && !session.activeCenterId)) {
    const scope = platformRole === "DEVELOPER" ? "developer" : "platform";
    const isSupportReadOnly =
      Boolean(session.isReadOnly) || platformRole === "PLATFORM_SUPPORT";

    return (
      <PanelThemeProvider initialTheme={theme} initialResolvedTheme={resolvedTheme}>
        <AppShell
          scope={scope}
          locale={locale}
          initialSidebarCollapsed={initialSidebarCollapsed}
          unreadNotificationsCount={unreadNotifCount}
          user={{
            fullName: session.user.fullName,
            email: session.user.email,
            avatarUrl: session.user.avatarUrl,
            platformRole,
          }}
          navContext={{
            scope,
            platformRole,
          }}
          readOnlyMode={isSupportReadOnly ? { active: true } : null}
          showReturnToCenterLink={scope === "platform"}
          showReturnToPlatformUi={scope === "developer"}
        >
          {children}
        </AppShell>
      </PanelThemeProvider>
    );
  }

  if (session.activeCenterId) {
    const activeRole = session.activeCenterRole || "STUDENT";
    const center = await db.learningCenter.findUnique({
      where: { id: session.activeCenterId },
    });

    if (center) {
      let planFeatures: PlanFeatures | undefined = undefined;
      try {
        const planCtx = await getCenterPlanFeatures(center.id);
        planFeatures = planCtx.features;
      } catch {
        planFeatures = undefined;
      }

      const currentMembership = session.memberships.find(
        (m) => m.centerId === center.id
      );
      let membershipPermissions: string | null = null;
      if (currentMembership?.id) {
        try {
          const row = await db.centerMembership.findUnique({
            where: { id: currentMembership.id },
            select: { permissions: true },
          });
          membershipPermissions = row?.permissions ?? null;
        } catch {}
      }

      let parentChildren: ParentChildOption[] = [];
      let selectedParentChildId: string | null = null;
      if (activeRole === "PARENT" && currentMembership?.id) {
        try {
          const links = await db.parentLink.findMany({
            where: { parentMembershipId: currentMembership.id, status: "CONFIRMED" },
            include: {
              student: { select: { id: true, user: { select: { fullName: true } } } },
            },
          });
          parentChildren = links.map((l) => ({
            studentMembershipId: l.student.id,
            fullName: l.student.user.fullName,
          }));
          const cookieChild = cookies().get(PARENT_CHILD_COOKIE)?.value;
          if (cookieChild && parentChildren.some((c) => c.studentMembershipId === cookieChild)) {
            selectedParentChildId = cookieChild;
          }
        } catch {}
      }

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
              platformRole,
              centerRole: activeRole,
            }}
            navContext={{
              scope: "center",
              platformRole,
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
                    role: activeRole,
                    centerName: center.name,
                    isReadOnly: Boolean(session.isReadOnly),
                  }
                : null
            }
            readOnlyMode={
              Boolean(session.isReadOnly) || platformRole === "PLATFORM_SUPPORT"
                ? { active: true }
                : null
            }
            showPlatformAdminShortcut={platformRole !== "NONE"}
          >
            {children}
          </AppShell>
        </PanelThemeProvider>
      );
    }
  }

  // Fallback for authenticated users without center or platform role
  return (
    <PanelThemeProvider initialTheme={theme} initialResolvedTheme={resolvedTheme}>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="h-14 px-4 sm:px-6 border-b border-border bg-card flex items-center justify-between">
          <Link
            href="/onboarding"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t(locale, "account.backToDashboard")}
          </Link>
          <ThemeToggle locale={locale} compact />
        </header>
        <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">{children}</main>
      </div>
    </PanelThemeProvider>
  );
}

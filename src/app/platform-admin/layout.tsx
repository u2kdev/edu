import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
// Reason: Exception: Platform layout loads unread notification count for authenticated platform staff.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { PanelThemeProvider } from "@/components/theme/PanelThemeProvider";
import { AppShell } from "@/components/shell/AppShell";
import { getServerPanelTheme } from "@/lib/panel-theme";
import { getServerSidebarCollapsed } from "@/lib/sidebar-state";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  // Only platform-level roles can access this section
  const allowedPlatformRoles = [
    "SUPERADMIN",
    "PLATFORM_ADMIN",
    "FULL_ACCESS",
    "PLATFORM_SUPPORT",
    "SEO_ADMIN",
  ];

  if (!allowedPlatformRoles.includes(session.user.platformRole)) {
    redirect("/center");
  }

  let unreadNotificationsCount = 0;
  try {
    unreadNotificationsCount = await db.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    });
  } catch {
    unreadNotificationsCount = 0;
  }

  const isSupportReadOnly =
    Boolean(session.isReadOnly) ||
    session.user.platformRole === "PLATFORM_SUPPORT";

  return (
    <PanelThemeProvider initialTheme={theme} initialResolvedTheme={resolvedTheme}>
      <AppShell
        scope="platform"
        locale={locale}
        initialSidebarCollapsed={initialSidebarCollapsed}
        unreadNotificationsCount={unreadNotificationsCount}
        user={{
          fullName: session.user.fullName,
          email: session.user.email,
          avatarUrl: session.user.avatarUrl,
          platformRole: session.user.platformRole,
        }}
        navContext={{
          scope: "platform",
          platformRole: session.user.platformRole,
        }}
        readOnlyMode={isSupportReadOnly ? { active: true } : null}
        showReturnToCenterLink
      >
        {children}
      </AppShell>
    </PanelThemeProvider>
  );
}

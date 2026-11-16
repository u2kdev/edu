import { ReactNode } from "react";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
// Reason: Exception: Developer layout loads unread notification count for authenticated developer/superadmin.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { PanelThemeProvider } from "@/components/theme/PanelThemeProvider";
import { AppShell } from "@/components/shell/AppShell";
import { getServerPanelTheme } from "@/lib/panel-theme";
import { getServerSidebarCollapsed } from "@/lib/sidebar-state";

export default async function DeveloperLayout({ children }: { children: ReactNode }) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.user.platformRole;
  const isAuthorized = role === "DEVELOPER" || role === "SUPERADMIN";

  if (!isAuthorized) {
    redirect("/platform"); // Redirect unauthorized roles
  }

  const locale = session.user.preferredLanguage || "ru";
  const [{ theme, resolvedTheme }, initialSidebarCollapsed] = await Promise.all([
    getServerPanelTheme(),
    Promise.resolve(getServerSidebarCollapsed()),
  ]);

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

  return (
    <PanelThemeProvider initialTheme={theme} initialResolvedTheme={resolvedTheme}>
      <AppShell
        scope="developer"
        locale={locale}
        initialSidebarCollapsed={initialSidebarCollapsed}
        unreadNotificationsCount={unreadNotificationsCount}
        user={{
          fullName: session.user.fullName,
          email: session.user.email,
          avatarUrl: session.user.avatarUrl,
          platformRole: role,
        }}
        navContext={{
          scope: "developer",
          platformRole: role,
        }}
        showReturnToPlatformUi
      >
        {children}
      </AppShell>
    </PanelThemeProvider>
  );
}

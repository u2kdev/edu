"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Terminal,
} from "lucide-react";
import {
  getBreadcrumbs,
  getVisibleNavigation,
  isNavItemActive,
  type AppScope,
  type NavigationContext,
} from "@/config/navigation";
import { hasPermission } from "@/lib/permissions";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/sidebar-constants";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { t } from "@/i18n";
import { NavIcon } from "./nav-icons";
import { UserMenuPopover } from "./UserMenuPopover";
import { CommandPalette } from "./CommandPalette";
import { NotificationBell } from "./NotificationBell";
import {
  ParentChildHeaderSwitcher,
  type ParentChildOption,
} from "./ParentChildHeaderSwitcher";
import { ReadOnlyBanner } from "./ReadOnlyBanner";

export interface AppShellUser {
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  platformRole: string;
  centerRole?: string;
}

export interface AppShellMembership {
  id: string;
  centerId: string;
  centerName: string;
  centerSlug: string;
  centerStatus: string;
  role: string;
}

export interface AppShellProps {
  children: ReactNode;
  scope: AppScope;
  locale: string;
  user: AppShellUser;
  navContext: NavigationContext;
  initialSidebarCollapsed?: boolean;
  unreadNotificationsCount?: number;
  center?: {
    id: string;
    name: string;
    logoUrl?: string | null;
    status?: string | null;
  } | null;
  memberships?: AppShellMembership[];
  parentChildren?: ParentChildOption[];
  selectedParentChildId?: string | null;
  impersonation?: {
    active: boolean;
    role: string;
    centerName: string;
    isReadOnly?: boolean;
  } | null;
  readOnlyMode?: {
    active: boolean;
    isSuspendedCenterNotice?: boolean;
  } | null;
  showReturnToCenterLink?: boolean;
  showPlatformAdminShortcut?: boolean;
  showReturnToPlatformUi?: boolean;
}

function AppShellInner({
  children,
  scope,
  locale,
  user,
  navContext,
  initialSidebarCollapsed = false,
  unreadNotificationsCount = 0,
  center,
  memberships = [],
  parentChildren = [],
  selectedParentChildId = null,
  impersonation = null,
  readOnlyMode = null,
  showReturnToCenterLink = false,
  showPlatformAdminShortcut = false,
  showReturnToPlatformUi = false,
}: AppShellProps) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const searchString = searchParams?.toString() || "";

  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Sync collapsed state from localStorage if cookie wasn't yet written
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_COOKIE);
      if (stored === "1") setCollapsed(true);
      else if (stored === "0") setCollapsed(false);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, searchString]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_COOKIE, next ? "1" : "0");
        document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const navGroups = useMemo(() => getVisibleNavigation(navContext), [navContext]);

  const breadcrumbItems = useMemo(() => {
    const seeds = getBreadcrumbs(pathname, searchString, navGroups, navContext);
    return seeds.map((s) => ({
      label: s.labelKey ? t(locale, s.labelKey) : s.labelFallback || "",
      href: s.href,
    }));
  }, [pathname, searchString, navGroups, navContext, locale]);

  const roleLabel =
    scope === "center"
      ? t(locale, `roles.${user.centerRole || "STUDENT"}`)
      : t(locale, `roles.${user.platformRole || "NONE"}`);

  const contextLabel =
    scope === "center"
      ? center?.name || t(locale, "nav.center")
      : scope === "developer"
        ? "DEV_PANEL"
        : t(locale, "shell.platformBadge");

  const brandHref =
    scope === "platform" ? "/platform-admin" : scope === "developer" ? "/developer" : "/center";

  const supportHref =
    scope === "center"
      ? "/center/support"
      : scope === "platform" && hasPermission("platform.support", user.platformRole)
        ? "/platform-admin/support"
        : null;

  const notificationsHref =
    scope === "center" ? "/center/notifications" : "/account?tab=notifications";

  const canSearchStudents =
    scope === "center" &&
    hasPermission(
      "students.read",
      navContext.platformRole ?? "NONE",
      navContext.centerRole,
      navContext.membershipPermissions
    );
  const canSearchGroups =
    scope === "center" &&
    hasPermission(
      "groups.read",
      navContext.platformRole ?? "NONE",
      navContext.centerRole,
      navContext.membershipPermissions
    );
  const canSearchCenters =
    scope === "platform" &&
    hasPermission("platform.centers.read", navContext.platformRole ?? "NONE");

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const isCompact = !isMobileDrawer && collapsed;

    return (
      <div className="flex flex-col h-full bg-card text-card-foreground">
        {/* Top brand + collapse toggle */}
        <div
          className={`border-b border-border flex items-center ${
            isCompact ? "justify-center p-3" : "justify-between px-4 py-3.5"
          }`}
        >
          <Link
            href={brandHref}
            onClick={() => isMobileDrawer && setMobileOpen(false)}
            className="flex items-center gap-2.5 min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={contextLabel}
          >
            <div className="h-9 w-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
              {scope === "center" && center?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={center.logoUrl}
                  alt={center.name}
                  className="w-6 h-6 rounded object-cover"
                />
              ) : scope === "developer" ? (
                <Terminal className="w-4 h-4 text-primary" aria-hidden="true" />
              ) : (
                <Building2 className="w-4 h-4 text-primary" aria-hidden="true" />
              )}
            </div>
            {!isCompact && (
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">
                  {scope === "developer"
                    ? "DEV_PANEL"
                    : scope === "platform"
                      ? t(locale, "common.brandName")
                      : center?.name || t(locale, "common.brandName")}
                </div>
                <div className="text-xs text-muted-foreground truncate">{roleLabel}</div>
              </div>
            )}
          </Link>

          {!isMobileDrawer && !isCompact && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={t(locale, "shell.collapseSidebar")}
              title={t(locale, "shell.collapseSidebar")}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Expand toggle button when collapsed */}
        {!isMobileDrawer && isCompact && (
          <div className="px-2 pt-2 flex justify-center">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={t(locale, "shell.expandSidebar")}
              title={t(locale, "shell.expandSidebar")}
              className="min-h-[40px] w-full flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Workspace Switcher only when multiple memberships exist */}
        {!isCompact && scope === "center" && memberships.length > 1 && (
          <div className="px-3 pt-3">
            <WorkspaceSwitcher
              memberships={memberships}
              activeCenterId={center?.id}
              platformRole={user.platformRole}
              locale={locale}
            />
          </div>
        )}

        {/* Role-scoped grouped navigation */}
        <nav
          aria-label={t(locale, "shell.navigationLabel")}
          className="flex-1 py-3 px-2.5 space-y-4 overflow-y-auto"
        >
          {navGroups.map((group) => (
            <div key={group.id}>
              {!isCompact && group.labelKey && (
                <div className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground">
                  {t(locale, group.labelKey)}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isNavItemActive(item, pathname, searchString);
                  const label = t(locale, item.labelKey);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => isMobileDrawer && setMobileOpen(false)}
                      aria-current={active ? "page" : undefined}
                      title={isCompact ? label : undefined}
                      className={`flex items-center gap-2.5 min-h-[40px] rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isCompact ? "justify-center px-2" : "px-2.5 py-2"
                      } ${
                        active
                          ? "bg-accent text-accent-foreground font-semibold border-l-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                      }`}
                    >
                      <NavIcon
                        name={item.icon}
                        className={`w-4 h-4 shrink-0 ${
                          active ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      {!isCompact && <span className="truncate">{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom context links + User Popover */}
        <div className="p-2.5 border-t border-border space-y-2">
          {showReturnToCenterLink && (
            <Link
              href="/center"
              onClick={() => isMobileDrawer && setMobileOpen(false)}
              title={isCompact ? t(locale, "nav.returnToCenter") : undefined}
              className={`flex items-center gap-2 min-h-[40px] rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isCompact ? "justify-center px-2" : "px-3 py-2"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {!isCompact && <span className="truncate">{t(locale, "nav.returnToCenter")}</span>}
            </Link>
          )}

          {showReturnToPlatformUi && (
            <Link
              href="/platform-admin"
              onClick={() => isMobileDrawer && setMobileOpen(false)}
              title={isCompact ? t(locale, "nav.returnToPlatform") : undefined}
              className={`flex items-center gap-2 min-h-[40px] rounded-lg border border-border text-xs font-medium text-primary hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isCompact ? "justify-center px-2" : "px-3 py-2"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {!isCompact && <span className="truncate">{t(locale, "nav.returnToPlatform")}</span>}
            </Link>
          )}

          {showPlatformAdminShortcut && (
            <Link
              href="/platform-admin"
              onClick={() => isMobileDrawer && setMobileOpen(false)}
              title={isCompact ? t(locale, "nav.platformAdmin") : undefined}
              className={`flex items-center gap-2 min-h-[40px] rounded-lg border border-destructive/20 bg-destructive-subtle/60 hover:bg-destructive-subtle text-xs font-medium text-destructive-subtle-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isCompact ? "justify-center px-2" : "px-3 py-2"
              }`}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {!isCompact && <span className="truncate">{t(locale, "nav.platformAdmin")}</span>}
            </Link>
          )}

          <UserMenuPopover
            user={user}
            roleLabel={roleLabel}
            contextLabel={contextLabel}
            locale={locale}
            scope={scope}
            supportHref={supportHref}
            collapsed={isCompact}
            onNavigate={() => isMobileDrawer && setMobileOpen(false)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {impersonation?.active && (
        <ImpersonationBanner
          userName={user.fullName}
          role={impersonation.role}
          centerName={impersonation.centerName}
          locale={locale}
          isReadOnly={impersonation.isReadOnly}
        />
      )}

      {!impersonation?.active && readOnlyMode?.active && (
        <ReadOnlyBanner
          locale={locale}
          centerStatus={center?.status}
          isSuspendedCenterNotice={readOnlyMode.isSuspendedCenterNotice}
        />
      )}

      {impersonation?.active && readOnlyMode?.isSuspendedCenterNotice && (
        <ReadOnlyBanner
          locale={locale}
          centerStatus={center?.status}
          isSuspendedCenterNotice
        />
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:flex shrink-0 flex-col bg-card border-r border-border sticky top-0 h-screen overflow-y-auto transition-[width] duration-150 ${
            collapsed ? "w-[68px]" : "w-64"
          }`}
        >
          {renderSidebarBody(false)}
        </aside>

        {/* Mobile Sheet Drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            locale={locale}
            className="w-72 max-w-[85vw] p-0 gap-0"
          >
            <SheetTitle className="sr-only">
              {t(locale, "ui.menuTitle")}
            </SheetTitle>
            {renderSidebarBody(true)}
          </SheetContent>
        </Sheet>

        {/* Main area with sticky TopBar */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-30 min-h-[56px] px-3 sm:px-5 py-2 border-b border-border bg-card/90 backdrop-blur-sm flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label={t(locale, "ui.openMenu")}
                className="md:hidden inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>

              <div className="min-w-0 overflow-hidden">
                <Breadcrumbs items={breadcrumbItems} locale={locale} />
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {scope === "center" &&
                user.centerRole === "PARENT" &&
                parentChildren.length > 0 && (
                  <ParentChildHeaderSwitcher
                    childrenList={parentChildren}
                    initialSelectedChildId={selectedParentChildId}
                    locale={locale}
                  />
                )}

              {scope === "developer" && (
                <div className="hidden sm:inline-flex items-center gap-2 rounded-md border border-border bg-success-subtle px-2.5 py-1">
                  <span className="w-2 h-2 rounded-full bg-success" aria-hidden="true" />
                  <span className="text-xs font-mono font-semibold text-success-subtle-foreground">
                    SYS_ONLINE
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                aria-label={t(locale, "shell.openCommandPalette")}
                title={`${t(locale, "shell.openCommandPalette")} (Ctrl+K)`}
                className="inline-flex items-center gap-2 min-h-[40px] px-2.5 sm:px-3 rounded-lg border border-border bg-background hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline truncate">
                  {t(locale, "shell.openCommandPalette")}
                </span>
                <kbd className="hidden md:inline-block px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-xs text-muted-foreground">
                  Ctrl+K
                </kbd>
              </button>

              <NotificationBell
                initialUnreadCount={unreadNotificationsCount}
                notificationsHref={notificationsHref}
                locale={locale}
              />

              <ThemeToggle locale={locale} compact />
            </div>
          </header>

          <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-x-hidden">
            <div className="max-w-7xl mx-auto min-w-0">{children}</div>
          </main>
        </div>
      </div>

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        scope={scope}
        groups={navGroups}
        locale={locale}
        canSearchStudents={canSearchStudents}
        canSearchGroups={canSearchGroups}
        canSearchCenters={canSearchCenters}
      />
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AppShellInner {...props} />
    </Suspense>
  );
}

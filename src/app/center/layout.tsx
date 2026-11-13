export const dynamic = "force-dynamic";

import { requireTenantPageAccess, TenantSuspendedError } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import CenterSuspendedPage from "./suspended/page";
import Link from "next/link";
import {
  BookOpen, Users, CalendarDays, ClipboardCheck,
  CreditCard, KeyRound, UserPlus, HelpCircle,
  Settings, ChevronRight, Home, GraduationCap,
  Building2, BarChart3, Megaphone, Bell, User, Heart,
  FolderOpen, FileCheck2, CalendarRange, Wallet,
  ClipboardList, Activity
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import LogoutButton from "@/components/LogoutButton";
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center max-w-md">
          <Building2 className="w-12 h-12 text-brand-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            {t(locale, "dashboard.selectCenter")}
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {t(locale, "student.useInviteCode")}
          </p>
          <Link
            href="/onboarding"
            className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all inline-block"
          >
            {t(locale, "landing.enterInviteCode")}
          </Link>
        </div>
      </div>
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

  // Load center data
  const center = await tenantCtx!.getTenantDb().learningCenter.findUnique({
    where: { id: session.activeCenterId },
  });

  if (!center) redirect("/login");

  const isBlockedOrCancelled = center.status === "BLOCKED" || center.status === "CANCELLED";
  const isOverdueOrPaused = center.status === "OVERDUE" || center.status === "PAUSED";

  if (isBlockedOrCancelled || (isOverdueOrPaused && !isDirector)) {
    return <CenterSuspendedPage />;
  }

  // Load unread notification count for the notification bell
  const unreadNotifCount = await tenantCtx!.getTenantDb().notification.count({
    where: {
      userId: session.user.id,
      isRead: false,
      OR: session.activeCenterId
        ? [{ centerId: session.activeCenterId }, { centerId: null }]
        : [{ centerId: null }],
    },
  });

  // Role-based navigation configuration
  const navSections = [
    {
      title: null, // No section title for main items
      items: [
        {
          href: "/center",
          icon: Home,
          label: t(locale, "nav.dashboard"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT", "TEACHER", "TEACHER_ASSISTANT", "CENTER_SUPPORT", "STUDENT", "PARENT"],
        },
      ],
    },
    {
      title: t(locale, "courses.title"),
      items: [
        {
          href: "/center/courses",
          icon: BookOpen,
          label: t(locale, "nav.courses"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT"],
        },
        {
          href: "/center/groups",
          icon: Users,
          label: t(locale, "nav.groups"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT"],
        },
        {
          href: "/center/students",
          icon: Users,
          label: t(locale, "nav.students"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT"],
        },
        {
          href: "/center/parents",
          icon: Heart,
          label: t(locale, "nav.parents"),
          roles: ["DIRECTOR", "CENTER_ADMIN"],
        },
        {
          href: "/center/schedule",
          icon: CalendarDays,
          label: t(locale, "nav.schedule"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT", "PARENT"],
        },
        {
          href: "/center/materials",
          icon: FolderOpen,
          label: t(locale, "nav.materials"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT"],
        },
      ],
    },
    {
      title: t(locale, "lessons.title"),
      items: [
        {
          href: "/center/attendance",
          icon: ClipboardCheck,
          label: t(locale, "nav.attendance"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT"],
        },
        {
          href: "/center/grades",
          icon: GraduationCap,
          label: t(locale, "nav.grades"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT", "PARENT"],
        },
        {
          href: "/center/homework",
          icon: BookOpen,
          label: t(locale, "nav.homework"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT", "PARENT"],
        },
        {
          href: "/center/tests",
          icon: FileCheck2,
          label: t(locale, "nav.tests"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT"],
        },
        {
          href: "/center/substitutions",
          icon: CalendarRange,
          label: t(locale, "nav.substitutions"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT"],
        },
      ],
    },
    {
      title: t(locale, "nav.center"),
      items: [
        {
          href: "/center/announcements",
          icon: Megaphone,
          label: t(locale, "nav.announcements"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "CENTER_SUPPORT", "STUDENT", "PARENT"],
        },
        {
          href: "/center/branches",
          icon: Building2,
          label: t(locale, "nav.branches"),
          roles: ["DIRECTOR", "CENTER_ADMIN"],
        },
      ],
    },
    {
      title: t(locale, "common.settings"),
      items: [
        {
          href: "/center/profile",
          icon: User,
          label: t(locale, "nav.profile"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "CENTER_SUPPORT", "STUDENT", "PARENT"],
        },
        {
          href: "/center/my-salary",
          icon: Wallet,
          label: t(locale, "nav.mySalary"),
          roles: ["TEACHER", "TEACHER_ASSISTANT"],
        },
        {
          href: "/center/staff",
          icon: UserPlus,
          label: t(locale, "nav.staff"),
          roles: ["DIRECTOR", "CENTER_ADMIN"],
        },
        {
          href: "/center/invites",
          icon: KeyRound,
          label: t(locale, "nav.invites"),
          roles: ["DIRECTOR", "CENTER_ADMIN"],
        },
        {
          href: "/center/settings/calendar",
          icon: CalendarRange,
          label: t(locale, "nav.calendarSettings"),
          roles: ["DIRECTOR", "CENTER_ADMIN"],
        },
        {
          href: "/center/payments",
          icon: CreditCard,
          label: t(locale, "nav.payments"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"],
        },
        {
          href: "/center/finance",
          icon: Wallet,
          label: t(locale, "nav.finance"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"],
        },
        {
          href: "/center/reports",
          icon: BarChart3,
          label: t(locale, "nav.reports"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"],
        },
        {
          href: "/center/activity",
          icon: Activity,
          label: t(locale, "nav.activity"),
          roles: ["DIRECTOR", "CENTER_ADMIN"],
        },
        {
          href: "/center/audit",
          icon: ClipboardList,
          label: t(locale, "nav.audit"),
          roles: ["DIRECTOR", "CENTER_ADMIN"],
        },
        {
          href: "/center/settings",
          icon: Settings,
          label: t(locale, "nav.centerSettings"),
          roles: ["DIRECTOR", "CENTER_ADMIN"],
        },
        {
          href: "/center/support",
          icon: HelpCircle,
          label: t(locale, "nav.support"),
          roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT", "TEACHER", "TEACHER_ASSISTANT", "CENTER_SUPPORT", "STUDENT", "PARENT"],
        },
      ],
    },
  ];

  // Role label mapping
  const roleLabels: Record<string, string> = {
    DIRECTOR: t(locale, "dashboard.directorCabinet"),
    CENTER_ADMIN: t(locale, "dashboard.adminCabinet"),
    ACCOUNTANT: t(locale, "dashboard.accountantCabinet"),
    TEACHER: t(locale, "dashboard.teacherCabinet"),
    TEACHER_ASSISTANT: t(locale, "dashboard.teacherAssistantCabinet"),
    CENTER_SUPPORT: t(locale, "support.title"),
    STUDENT: t(locale, "dashboard.studentCabinet"),
    PARENT: t(locale, "dashboard.parentCabinet"),
  };

  const isImpersonating = Boolean(
    session.impersonatorUserId || cookies().get("platform_impersonation_original")?.value
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {isImpersonating && (
        <ImpersonationBanner
          userName={session.user.fullName}
          role={session.activeCenterRole || tenantCtx?.role || "MEMBER"}
          centerName={center.name}
          locale={locale}
        />
      )}
      {isOverdueOrPaused && isDirector && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
              {center.status}
            </span>
            <span>
              {t(locale, "dashboard.suspendedNotice")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/center/suspended"
              className="underline hover:text-white"
            >
              {t(locale, "dashboard.moreDetails")}
            </Link>
            <Link
              href="/center/support"
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
            >
              {t(locale, "dashboard.writeToSupport")}
            </Link>
          </div>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-72 min-h-screen glass-panel border-r border-slate-800/80 flex flex-col sticky top-0 h-screen overflow-y-auto">
        {/* Center branding header */}
        <div className="p-5 border-b border-slate-800/60">
          <Link href="/center" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/30 transition-shadow">
              {center.logoUrl ? (
                <img
                  src={center.logoUrl}
                  alt={center.name}
                  className="w-6 h-6 rounded object-cover"
                />
              ) : (
                <Building2 className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold tracking-tight text-white truncate block">
                {center.name}
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                {roleLabels[activeRole] || activeRole}
              </span>
            </div>
          </Link>
        </div>

        {/* Workspace switcher (if user has multiple centers) */}
        {session.memberships.length > 1 && (
          <div className="px-3 pt-3">
            <WorkspaceSwitcher
              memberships={session.memberships}
              activeCenterId={session.activeCenterId}
              platformRole={session.user.platformRole}
            />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
          {navSections.map((section, sIdx) => {
            const visibleItems = section.items.filter((item) =>
              item.roles.includes(activeRole)
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx}>
                {section.title && (
                  <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    {section.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all group"
                    >
                      <item.icon className="w-[18px] h-[18px] text-slate-500 group-hover:text-brand-400 transition-colors" />
                      <span>{item.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-slate-800/60 space-y-3">
          {/* Platform admin link (for users with platform roles) */}
          {session.user.platformRole !== "NONE" && (
            <Link
              href="/platform-admin"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t(locale, "nav.platformAdmin")}</span>
            </Link>
          )}

          {/* Language switcher */}
          <LanguageSwitcher currentLocale={locale} />

          {/* User info */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-brand-400">
              {session.user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {session.user.fullName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {session.user.email}
              </div>
            </div>
          </div>

          <LogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top header bar with notification bell */}
        <div className="sticky top-0 z-30 px-8 py-3 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md flex items-center justify-end gap-4">
          <Link
            href="/center/notifications"
            className="relative p-2 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-white transition-all"
            title={t(locale, "nav.notifications")}
          >
            <Bell className="w-5 h-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-500 text-[9px] font-bold text-white flex items-center justify-center">
                {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
              </span>
            )}
          </Link>
        </div>
        <div className="flex-1 p-8 overflow-y-auto">{children}</div>
      </main>
      </div>
    </div>
  );
}

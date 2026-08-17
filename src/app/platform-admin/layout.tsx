import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  Building2, Users, CreditCard, BarChart3, Shield, 
  Settings, LogOut, HelpCircle, Eye, FileText,
  ChevronRight
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LogoutButton from "@/components/LogoutButton";
import { t } from "@/i18n";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage;

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

  const navItems = [
    {
      href: "/platform-admin",
      icon: BarChart3,
      label: t(locale, "platform.analytics"),
      roles: ["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT"],
    },
    {
      href: "/platform-admin/centers",
      icon: Building2,
      label: t(locale, "platform.centerManagement"),
      roles: ["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS"],
    },
    {
      href: "/platform-admin/plans",
      icon: CreditCard,
      label: t(locale, "platform.plans"),
      roles: ["SUPERADMIN", "PLATFORM_ADMIN"],
    },
    {
      href: "/platform-admin/subscriptions",
      icon: FileText,
      label: t(locale, "platform.subscriptions"),
      roles: ["SUPERADMIN", "PLATFORM_ADMIN"],
    },
    {
      href: "/platform-admin/support",
      icon: HelpCircle,
      label: t(locale, "support.title"),
      roles: ["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT"],
    },
    {
      href: "/platform-admin/impersonate",
      icon: Eye,
      label: t(locale, "platform.impersonate"),
      roles: ["SUPERADMIN", "PLATFORM_SUPPORT"],
    },
    {
      href: "/platform-admin/audit",
      icon: Shield,
      label: t(locale, "platform.auditLog"),
      roles: ["SUPERADMIN"],
    },
  ];

  const visibleNav = navItems.filter((item) =>
    item.roles.includes(session.user.platformRole)
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-72 min-h-screen glass-panel border-r border-slate-800/80 flex flex-col sticky top-0 h-screen overflow-y-auto">
        {/* Logo / Header */}
        <div className="p-5 border-b border-slate-800/60">
          <Link href="/platform-admin" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:shadow-red-500/30 transition-shadow">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">
                Academia<span className="text-red-400">Admin</span>
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                {t(locale, "roles." + session.user.platformRole)}
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all group"
            >
              <item.icon className="w-4.5 h-4.5 text-slate-500 group-hover:text-red-400 transition-colors" />
              <span>{item.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-slate-800/60 space-y-3">
          {/* Language switcher */}
          <LanguageSwitcher currentLocale={locale} />

          {/* User info */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-red-400">
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
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}

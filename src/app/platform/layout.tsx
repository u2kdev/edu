import { ReactNode } from "react";
import Link from "next/link";
import { Building2, LayoutDashboard, Users, CreditCard, LifeBuoy, Settings, Bell } from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.user.platformRole;
  const isPlatformOwner = ["PLATFORM_ADMIN", "SUPERADMIN", "DEVELOPER", "FULL_ACCESS"].includes(role);

  if (!isPlatformOwner) {
    redirect("/dashboard");
  }

  const isDeveloper = ["SUPERADMIN", "DEVELOPER"].includes(role);

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-200 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <Link href="/platform" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 to-indigo-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-wide">Platform</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <Link href="/platform" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
            <LayoutDashboard className="w-4 h-4 text-brand-400" />
            Дашборд
          </Link>
          <Link href="/platform/tenants" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Учебные центры
          </Link>
          <Link href="/platform/subscriptions" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            Тарифы и биллинг
          </Link>
          <Link href="/platform/support" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
            <LifeBuoy className="w-4 h-4 text-amber-400" />
            Поддержка
          </Link>
          <Link href="/platform/announcements" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
            <Bell className="w-4 h-4 text-rose-400" />
            Оповещения
          </Link>
          <Link href="/platform/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
            <Settings className="w-4 h-4 text-slate-400" />
            Настройки SaaS
          </Link>

          {isDeveloper && (
            <>
              <div className="pt-4 pb-2">
                <span className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Developer
                </span>
              </div>
              <Link href="/developer" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-800 text-purple-400 hover:text-purple-300 transition-colors">
                <Settings className="w-4 h-4" />
                Dev Control Panel
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300">
              {session.user.fullName?.charAt(0) || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{session.user.fullName}</p>
              <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        <header className="h-16 flex items-center justify-between px-8 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-20">
          <h2 className="text-lg font-semibold text-white">Platform Administration</h2>
          <Link href="/dashboard" className="text-sm text-brand-400 hover:text-brand-300">
            Вернуться в LMS
          </Link>
        </header>
        <div className="flex-1 p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Building2, LayoutDashboard, BookOpen, Users, KeyRound, CreditCard, Shield, LogOut, ChevronDown, UserCheck } from "lucide-react";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import LogoutButton from "@/components/LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  const activeCenter = session.memberships.find((m) => m.centerId === session.activeCenterId);
  const activeRole = session.activeCenterRole || activeCenter?.role || (session.user.platformRole !== "NONE" ? "PLATFORM" : "GUEST");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 glass-panel border-r border-slate-800/80 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Brand */}
          <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">Academia<span className="text-brand-400">SaaS</span></span>
              <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">LMS Workspace</span>
            </div>
          </div>

          {/* Workspace Switcher */}
          <div className="p-4 border-b border-slate-800/80">
            <WorkspaceSwitcher
              memberships={session.memberships}
              activeCenterId={session.activeCenterId}
              platformRole={session.user.platformRole}
            />
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-brand-400" />
              <span>Главная Панель</span>
            </Link>

            {(activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN" || activeRole === "TEACHER" || activeRole === "STUDENT") && (
              <Link
                href="/dashboard/courses"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
              >
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span>Курсы и Уроки</span>
              </Link>
            )}

            {(activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN" || activeRole === "TEACHER") && (
              <Link
                href="/dashboard/groups"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Группы и Ученики</span>
              </Link>
            )}

            {(activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN") && (
              <Link
                href="/dashboard/invites"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Инвайт-коды</span>
              </Link>
            )}

            <Link
              href="/dashboard/payments"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span>Оплаты курсов</span>
            </Link>

            {session.user.platformRole !== "NONE" && (
              <Link
                href="/dashboard/platform"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-purple-300 hover:text-purple-100 hover:bg-purple-950/40 transition-colors border border-purple-500/20"
              >
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Админка Платформы</span>
              </Link>
            )}
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{session.user.fullName}</p>
              <span className="inline-block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                {activeRole === "DIRECTOR" && "👑 Директор"}
                {activeRole === "CENTER_ADMIN" && "⚙️ Админ центра"}
                {activeRole === "TEACHER" && "🎓 Преподаватель"}
                {activeRole === "STUDENT" && "🎒 Ученик"}
                {activeRole === "PARENT" && "👨‍👩‍👧 Родитель"}
                {activeRole === "PLATFORM" && "🛡️ Админ платформы"}
              </span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-6 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2, Users, TrendingUp, CreditCard,
  AlertTriangle, CheckCircle2, Clock, Activity,
  Eye, Wrench, ShieldAlert
} from "lucide-react";
import { t, formatCurrencyLocalized, formatDateLocalized } from "@/i18n";
import ImpersonateButton from "@/components/ImpersonateButton";

export default async function PlatformAdminDashboard() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage;
  const isFullAccess = session.user.platformRole === "FULL_ACCESS";

  // Platform analytics
  const totalCenters = await db.learningCenter.count();
  const activeCenters = await db.learningCenter.count({ where: { status: "ACTIVE" } });
  const frozenCenters = await db.learningCenter.count({ where: { status: "FROZEN" } });
  const trialCenters = await db.learningCenter.count({ where: { status: "TRIAL" } });
  const blockedCenters = await db.learningCenter.count({ where: { status: "BLOCKED" } });

  const totalUsers = await db.platformUser.count();
  const totalStudents = await db.centerMembership.count({ where: { role: "STUDENT", status: "ACTIVE" } });
  const totalTeachers = await db.centerMembership.count({ where: { role: "TEACHER", status: "ACTIVE" } });

  // Centers with expiring subscriptions (within next 7 days)
  const expiringSubscriptions = await db.subscription.findMany({
    where: {
      currentPeriodEndsAt: {
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      center: { select: { id: true, name: true, slug: true, status: true, owner: { select: { fullName: true, email: true } } } },
      plan: true,
    },
  });

  // Recent centers with owner info
  const recentCenters = await db.learningCenter.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, fullName: true, email: true } },
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: {
          memberships: true,
          courses: true,
        },
      },
    },
  });

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    TRIAL: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    FROZEN: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    BLOCKED: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className="space-y-8">
      {/* FULL_ACCESS Engineering Banner */}
      {isFullAccess && (
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <strong>Режим инженерного доступа (FULL_ACCESS):</strong> Вам доступны технические настройки и поддержка всех сервисов платформы.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative glass-panel p-8 rounded-3xl border border-slate-800/80 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold uppercase tracking-wider rounded-full">
              {t(locale, "platform.title")}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">
            {t(locale, "dashboard.welcome", { name: session.user.fullName })}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {t(locale, "platform.analytics")} — {t(locale, "roles." + session.user.platformRole)}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t(locale, "platform.centerManagement")}
            </span>
            <div className="text-3xl font-bold text-white mt-2">{totalCenters}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-emerald-400">{activeCenters} {t(locale, "platform.active").toLowerCase()}</span>
              {frozenCenters > 0 && (
                <span className="text-xs text-amber-400">• {frozenCenters} {t(locale, "platform.frozen").toLowerCase()}</span>
              )}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ученики Платформы
            </span>
            <div className="text-3xl font-bold text-white mt-2">{totalStudents}</div>
            <div className="text-xs text-slate-500 mt-1">{totalUsers} пользователей</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Учителя Платформы
            </span>
            <div className="text-3xl font-bold text-white mt-2">{totalTeachers}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t(locale, "platform.trial")}
            </span>
            <div className="text-3xl font-bold text-blue-400 mt-2">{trialCenters}</div>
            {expiringSubscriptions.length > 0 && (
              <div className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {expiringSubscriptions.length} истекают на этой неделе
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recent Centers Table + 1-Click Impersonate */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Учебные Центры и Быстрый Вход (Support Impersonation)</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-800/40">
                <th className="text-left px-6 py-3 font-semibold">{t(locale, "platform.centerName")}</th>
                <th className="text-left px-6 py-3 font-semibold">{t(locale, "roles.DIRECTOR")}</th>
                <th className="text-left px-6 py-3 font-semibold">{t(locale, "common.status")}</th>
                <th className="text-left px-6 py-3 font-semibold">{t(locale, "platform.selectPlan")}</th>
                <th className="text-right px-6 py-3 font-semibold">1-Click Вход</th>
              </tr>
            </thead>
            <tbody>
              {recentCenters.map((center) => (
                <tr key={center.id} className="border-b border-slate-800/20 hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{center.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{center.slug}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-300">{center.owner.fullName}</div>
                    <div className="text-xs text-slate-500">{center.owner.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors[center.status] || "text-slate-400"}`}>
                      {t(locale, "platform." + center.status.toLowerCase())}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {center.subscriptions[0]?.plan?.name || "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ImpersonateButton targetUserId={center.owner.id} targetCenterId={center.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

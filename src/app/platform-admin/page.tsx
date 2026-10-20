import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Users,
  CreditCard,
  AlertTriangle,
  Clock,
  Activity,
  Wrench,
  ChevronRight,
  Shield,
  FileText,
  Sparkles,
} from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";
import ImpersonateButton from "@/components/ImpersonateButton";

export default async function PlatformAdminDashboard() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage;
  const isFullAccess = session.user.platformRole === "FULL_ACCESS";

  // Platform analytics with real database aggregations
  const totalCenters = await db.learningCenter.count();
  const activeCenters = await db.learningCenter.count({ where: { status: "ACTIVE" } });
  const pausedCenters = await db.learningCenter.count({ where: { status: "PAUSED" } });
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
      center: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          owner: { select: { fullName: true, email: true } },
        },
      },
      plan: true,
    },
    take: 5,
  });

  // Recent centers with owner info
  const recentCenters = await db.learningCenter.findMany({
    take: 8,
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

  const statusBadges: Record<string, { bg: string; text: string; border: string }> = {
    ACTIVE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    TRIAL: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    PAUSED: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    BLOCKED: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  };

  return (
    <div className="space-y-8">
      {/* FULL_ACCESS Engineering Banner */}
      {isFullAccess && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Wrench className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <strong className="font-semibold">Режим инженерного доступа (FULL_ACCESS):</strong> Вам доступны технические настройки и сквозной мониторинг всех центров платформы.
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white p-6 md:p-8 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wider rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              {t(locale, "platform.title")}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t(locale, "dashboard.welcome", { name: session.user.fullName })}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t(locale, "platform.analytics")} — {t(locale, "roles." + session.user.platformRole)}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/platform-admin/centers"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>Все центры</span>
          </Link>
          <Link
            href="/platform-admin/plans"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm transition-all"
          >
            <CreditCard className="w-4 h-4 text-slate-500" />
            <span>{t(locale, "platform.plans")}</span>
          </Link>
          <Link
            href="/platform-admin/audit"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm transition-all"
          >
            <Shield className="w-4 h-4 text-slate-500" />
            <span>{t(locale, "platform.auditLog")}</span>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Centers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t(locale, "platform.centerManagement")}
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{totalCenters}</div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {activeCenters} {t(locale, "platform.active").toLowerCase()}
            </span>
            {pausedCenters > 0 && (
              <span className="font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {pausedCenters} {t(locale, "platform.frozen").toLowerCase()}
              </span>
            )}
            {blockedCenters > 0 && (
              <span className="font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                {blockedCenters} {t(locale, "platform.blocked").toLowerCase()}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ученики платформы
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{totalStudents}</div>
          <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
            {totalUsers} аккаунтов зарегистрировано
          </div>
        </div>

        {/* Card 3: Teachers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Учителя платформы
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{totalTeachers}</div>
          <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
            Активные преподавательские профили
          </div>
        </div>

        {/* Card 4: Subscriptions / Trials */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t(locale, "platform.trial")}
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{trialCenters}</div>
          <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
            {expiringSubscriptions.length > 0 ? (
              <span className="text-amber-700 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {expiringSubscriptions.length} подписок истекают скоро
              </span>
            ) : (
              <span>Все тарифные планы в норме</span>
            )}
          </div>
        </div>
      </div>

      {/* Expiring Subscriptions Notification */}
      {expiringSubscriptions.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Подписки с истекающим сроком действия (в ближайшие 7 дней)</span>
            </div>
            <Link
              href="/platform-admin/subscriptions"
              className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline"
            >
              Управление подписками &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiringSubscriptions.map((sub) => (
              <div
                key={sub.id}
                className="bg-white p-3.5 rounded-xl border border-amber-200/60 shadow-sm flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{sub.center.name}</div>
                  <div className="text-xs text-slate-500">
                    Тариф: {sub.plan.name} • До: {formatDateLocalized(sub.currentPeriodEndsAt, locale)}
                  </div>
                </div>
                <Link
                  href={`/platform-admin/centers/${sub.center.id}`}
                  className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                >
                  Карточка
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Centers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Недавно добавленные центры и быстрый доступ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Мониторинг статуса и вход от имени владельца для технической поддержки
            </p>
          </div>
          <Link
            href="/platform-admin/centers"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
          >
            <span>{t(locale, "common.viewAll")}</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                <th className="text-left px-6 py-3.5">{t(locale, "platform.centerName")}</th>
                <th className="text-left px-6 py-3.5">{t(locale, "roles.DIRECTOR")}</th>
                <th className="text-left px-6 py-3.5">{t(locale, "common.status")}</th>
                <th className="text-left px-6 py-3.5">{t(locale, "platform.selectPlan")}</th>
                <th className="text-right px-6 py-3.5">Быстрый вход</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentCenters.map((center) => {
                const badge = statusBadges[center.status] || {
                  bg: "bg-slate-100",
                  text: "text-slate-700",
                  border: "border-slate-200",
                };
                return (
                  <tr key={center.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/platform-admin/centers/${center.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {center.name}
                      </Link>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{center.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800 font-medium">{center.owner.fullName}</div>
                      <div className="text-xs text-slate-500">{center.owner.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {t(locale, "platform." + center.status.toLowerCase())}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {center.subscriptions[0]?.plan?.name || "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ImpersonateButton targetUserId={center.owner.id} targetCenterId={center.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { requireTenantAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { getTenantDb } from "@/lib/db-tenant";
import { redirect } from "next/navigation";
import { BarChart3, CreditCard, Users, AlertTriangle, Sparkles, MessageSquare, Phone } from "lucide-react";
import { t, formatCurrencyLocalized } from "@/i18n";

export default async function CenterReportsPage() {
  const tenantCtx = await requireTenantAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const role = session.activeCenterRole;
  if (role !== "DIRECTOR" && role !== "CENTER_ADMIN") {
    redirect("/center");
  }

  const locale = session.user.preferredLanguage;

  const paidSum = await getTenantDb(tenantCtx.center.id).centerPayment.aggregate({
    where: { centerId, status: "PAID" },
    _sum: { amount: true },
    _count: true,
  });

  const pendingSum = await getTenantDb(tenantCtx.center.id).centerPayment.aggregate({
    where: { centerId, status: "PENDING" },
    _sum: { amount: true },
    _count: true,
  });

  const activeStudentsCount = await getTenantDb(tenantCtx.center.id).centerMembership.count({
    where: { centerId, role: "STUDENT", status: "ACTIVE" },
  });

  const avgPayment = paidSum._count > 0 ? (paidSum._sum.amount || 0) / paidSum._count : 150000;
  const expectedMRR = Math.round(activeStudentsCount * avgPayment);

  const debtors = await getTenantDb(tenantCtx.center.id).centerPayment.findMany({
    where: { centerId, status: "PENDING" },
    include: {
      student: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
      group: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Teacher hours report
  const teachers = await getTenantDb(tenantCtx.center.id).centerMembership.findMany({
    where: { centerId, role: "TEACHER" },
    include: {
      user: { select: { fullName: true, email: true } },
      taughtGroups: { include: { enrollments: true } },
      substituteLessons: true,
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{t(locale, "nav.reports")}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{t(locale, "payments.financialReport")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t(locale, "payments.totalCollected")}
            </span>
            <div className="text-3xl font-bold text-emerald-400 mt-2">
              {formatCurrencyLocalized(paidSum._sum.amount || 0, locale, "UZS")}
            </div>
            <div className="text-xs text-slate-500 mt-1">{paidSum._count} {t(locale, "payments.paid").toLowerCase()}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Прогноз MRR на сл. месяц
            </span>
            <div className="text-3xl font-bold text-brand-400 mt-2">
              {formatCurrencyLocalized(expectedMRR, locale, "UZS")}
            </div>
            <div className="text-xs text-slate-500 mt-1">{activeStudentsCount} активных учеников</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t(locale, "payments.totalExpected")}
            </span>
            <div className="text-3xl font-bold text-amber-400 mt-2">
              {formatCurrencyLocalized(pendingSum._sum.amount || 0, locale, "UZS")}
            </div>
            <div className="text-xs text-slate-500 mt-1">{pendingSum._count} {t(locale, "payments.pending").toLowerCase()}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Debtors List with 1-Click WhatsApp / Call reminders */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          <span>{t(locale, "payments.debtors")} и Напоминания в 1-Click</span>
        </h3>

        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">{t(locale, "nav.students")}</th>
                <th className="p-4">{t(locale, "auth.phone")}</th>
                <th className="p-4">{t(locale, "groups.title")}</th>
                <th className="p-4">{t(locale, "payments.amount")}</th>
                <th className="p-4 text-right">Быстрое действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {debtors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    {t(locale, "common.noData")}
                  </td>
                </tr>
              ) : (
                debtors.map((d) => {
                  const phoneClean = d.student.user.phone ? d.student.user.phone.replace(/[^0-9]/g, "") : "";
                  const waText = encodeURIComponent(`Здравствуйте, ${d.student.user.fullName}! Напоминаем об оплате обучения на сумму ${d.amount} UZS.`);
                  return (
                    <tr key={d.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-4 font-semibold text-white">
                        {d.student.user.fullName}
                      </td>
                      <td className="p-4 text-slate-400">
                        {d.student.user.phone || d.student.user.email}
                      </td>
                      <td className="p-4 text-slate-300">
                        {d.group?.name || "—"}
                      </td>
                      <td className="p-4 font-bold text-amber-400">
                        {formatCurrencyLocalized(d.amount, locale, "UZS")}
                      </td>
                      <td className="p-4 text-right">
                        {phoneClean ? (
                          <a
                            href={`https://wa.me/${phoneClean}?text=${waText}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/20 transition-all inline-flex items-center gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp Напомнить</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teacher Hours & Salary Calculation Report (For Director) */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-400" />
          <span>Отчёт по Часам Учителей и Расчёту Зарплаты</span>
        </h3>

        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">Учитель</th>
                <th className="p-4">Активных Групп</th>
                <th className="p-4">Учеников Обучено</th>
                <th className="p-4">Проведено Замен</th>
                <th className="p-4 text-right">Примерно Часов в Месяц</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {teachers.map((t) => {
                const totalStudents = t.taughtGroups.reduce((acc, g) => acc + g.enrollments.length, 0);
                const estHours = t.taughtGroups.length * 12 + t.substituteLessons.length * 1.5;
                return (
                  <tr key={t.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-4 font-semibold text-white">
                      {t.user.fullName}
                    </td>
                    <td className="p-4 text-slate-300">
                      {t.taughtGroups.length} групп
                    </td>
                    <td className="p-4 text-slate-300">
                      {totalStudents} учеников
                    </td>
                    <td className="p-4 text-amber-400 font-medium">
                      {t.substituteLessons.length} замен
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-400">
                      ~{estHours} акад. часов
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

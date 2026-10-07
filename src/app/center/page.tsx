import { requireTenantAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { getTenantDb } from "@/lib/db-tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users, BookOpen, CreditCard, Sparkles, CheckCircle2,
  ArrowRight, AlertTriangle, CalendarDays, ClipboardCheck,
  Flame, Clock, ShieldCheck
} from "lucide-react";
import { t, formatCurrencyLocalized, formatDateLocalized } from "@/i18n";

export default async function CenterDashboardPage() {
  const tenantCtx = await requireTenantAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage;
  const activeCenterId = session.activeCenterId;
  const activeRole = session.activeCenterRole || "";

  if (!activeCenterId) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">{t(locale, "dashboard.selectCenter")}</p>
      </div>
    );
  }

  const center = await getTenantDb(tenantCtx.center.id).learningCenter.findUnique({
    where: { id: activeCenterId },
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!center) redirect("/login");

  let activeStudentsCount = 0;
  let activeTeachersCount = 0;
  let coursesCount = 0;
  let totalRevenue = 0;
  let studentEnrollments: any[] = [];
  let parentChildren: any[] = [];
  let pendingHomeworksCount = 0;
  let urgentHomeworks: any[] = [];
  let attendanceRate: number | null = null;

  activeStudentsCount = await getTenantDb(tenantCtx.center.id).centerMembership.count({
    where: { centerId: activeCenterId, role: "STUDENT", status: "ACTIVE" },
  });

  activeTeachersCount = await getTenantDb(tenantCtx.center.id).centerMembership.count({
    where: { centerId: activeCenterId, role: "TEACHER", status: "ACTIVE" },
  });

  coursesCount = await getTenantDb(tenantCtx.center.id).course.count({
    where: { centerId: activeCenterId },
  });

  const payments = await getTenantDb(tenantCtx.center.id).centerPayment.aggregate({
    where: { centerId: activeCenterId, status: "PAID" },
    _sum: { amount: true },
  });
  totalRevenue = payments._sum.amount || 0;

  // Teacher specific pending homework reviews
  if (activeRole === "TEACHER") {
    pendingHomeworksCount = await getTenantDb(tenantCtx.center.id).homeworkSubmission.count({
      where: {
        homework: { lesson: { module: { course: { centerId: activeCenterId } } } },
        grade: null,
      },
    });
  }

  // Student specific data
  if (activeRole === "STUDENT") {
    const studentMem = session.memberships.find((m) => m.centerId === activeCenterId);
    if (studentMem) {
      studentEnrollments = await getTenantDb(tenantCtx.center.id).enrollment.findMany({
        where: { studentMembershipId: studentMem.id },
        include: {
          group: {
            include: {
              course: true,
              teacher: { include: { user: { select: { fullName: true } } } },
            },
          },
        },
      });

      urgentHomeworks = await getTenantDb(tenantCtx.center.id).homework.findMany({
        where: {
          lesson: { module: { course: { centerId: activeCenterId } } },
          dueDate: { gte: new Date() },
        },
        take: 3,
        orderBy: { dueDate: "asc" },
      });

      const studentAttendances = await getTenantDb(tenantCtx.center.id).attendance.findMany({
        where: { studentMembershipId: studentMem.id },
      });
      const presentCount = studentAttendances.filter(a => a.status === "PRESENT").length;
      const totalAttendances = studentAttendances.length;
      attendanceRate = totalAttendances > 0 ? Math.round((presentCount / totalAttendances) * 100) : null;
    }
  }

  // Parent specific data
  if (activeRole === "PARENT") {
    const parentMem = session.memberships.find((m) => m.centerId === activeCenterId);
    if (parentMem) {
      parentChildren = await getTenantDb(tenantCtx.center.id).parentLink.findMany({
        where: { parentMembershipId: parentMem.id, status: "CONFIRMED" },
        include: {
          student: {
            include: {
              user: true,
              enrollments: { include: { group: { include: { course: true } } } },
              payments: { take: 5, orderBy: { createdAt: "desc" } },
            },
          },
        },
      });
    }
  }

  const currentSub = center.subscriptions[0];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative glass-panel p-8 rounded-3xl border border-slate-800/80 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider rounded-full">
                {activeRole === "DIRECTOR" && t(locale, "dashboard.directorCabinet")}
                {activeRole === "CENTER_ADMIN" && t(locale, "dashboard.adminCabinet")}
                {activeRole === "TEACHER" && t(locale, "dashboard.teacherCabinet")}
                {activeRole === "STUDENT" && t(locale, "dashboard.studentCabinet")}
                {activeRole === "PARENT" && t(locale, "dashboard.parentCabinet")}
              </span>
              <span className="text-xs text-slate-400">
                • Slug: <code className="text-slate-200">{center.slug}</code>
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-white">
              {t(locale, "dashboard.welcome", { name: session.user.fullName })}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {t(locale, "dashboard.welcomeToCenter", { centerName: center.name })}
            </p>
          </div>

          {activeRole === "TEACHER" && (
            <div className="glass-panel p-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 text-right shrink-0">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Непроверенные ДЗ</div>
              <div className="text-2xl font-extrabold text-amber-400 mt-0.5">{pendingHomeworksCount} работ</div>
              <Link href="/center/homework" className="text-xs text-brand-400 hover:underline mt-1 inline-block">
                Перейти к проверке →
              </Link>
            </div>
          )}

          {activeRole === "STUDENT" && (
            <div className="glass-panel p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-right shrink-0 flex items-center gap-3">
              <ClipboardCheck className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Посещаемость</div>
                <div className="text-xl font-bold text-white">
                  {attendanceRate !== null ? `${attendanceRate}%` : "—"}
                </div>
                <div className="text-[10px] text-emerald-400">Успеваемость</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Student View: Urgent Homeworks Widget */}
      {activeRole === "STUDENT" && (
        <div className="space-y-6">
          {urgentHomeworks.length > 0 && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Горящие домашние задания (Сдать в ближайшие дни)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {urgentHomeworks.map((hw) => (
                  <div key={hw.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                    <div className="font-bold text-white">{hw.title}</div>
                    <div className="text-amber-400 font-medium">Срок: {formatDateLocalized(hw.dueDate, locale)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-xl font-bold text-white">{t(locale, "student.myCourses")}</h2>
          {studentEnrollments.length === 0 ? (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
              <p className="text-slate-400">{t(locale, "student.noCourses")}</p>
              <p className="text-xs text-slate-500 mt-1">{t(locale, "student.useInviteCode")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {studentEnrollments.map((en: any) => (
                <div key={en.id} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                        {t(locale, "courses.title")}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">{en.group.course.title}</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                      {en.group.name}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {t(locale, "student.teacher")}: <span className="text-slate-200 font-medium">
                      {en.group.teacher?.user.fullName || t(locale, "student.assigningTeacher")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Parent View */}
      {activeRole === "PARENT" && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">{t(locale, "parent.childProgress")}</h2>
          {parentChildren.length === 0 ? (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center space-y-3">
              <p className="text-slate-400">{t(locale, "parent.noChildren")}</p>
              <p className="text-xs text-slate-500">{t(locale, "parent.getInviteCode")}</p>
            </div>
          ) : (
            parentChildren.map((link: any) => (
              <div key={link.id} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center font-bold">
                      👶
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{link.student.user.fullName}</h3>
                      <p className="text-xs text-slate-400">{link.student.user.email}</p>
                    </div>
                  </div>

                  <Link
                    href="/center/payments"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                  >
                    💳 Оплатить следующий месяц
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t(locale, "parent.coursesAndGroups")}
                    </span>
                    <ul className="mt-2 space-y-2 text-sm">
                      {link.student.enrollments.map((e: any) => (
                        <li key={e.id} className="text-slate-200 font-medium flex justify-between">
                          <span>{e.group.course.title}</span>
                          <span className="text-xs text-brand-400 font-semibold">{e.group.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t(locale, "parent.paymentHistory")}
                    </span>
                    <ul className="mt-2 space-y-2 text-sm">
                      {link.student.payments.map((p: any) => (
                        <li key={p.id} className="text-slate-200 flex justify-between">
                          <span>{formatCurrencyLocalized(p.amount, locale, "UZS")}</span>
                          <span className="text-xs text-emerald-400 font-semibold">{p.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Metrics Grid (Director/Admin) */}
      {(activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN") && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t(locale, "dashboard.activeStudents")}
              </span>
              <div className="text-3xl font-bold text-white mt-2">{activeStudentsCount}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t(locale, "dashboard.teachers")}
              </span>
              <div className="text-3xl font-bold text-white mt-2">{activeTeachersCount}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t(locale, "dashboard.totalCourses")}
              </span>
              <div className="text-3xl font-bold text-white mt-2">{coursesCount}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t(locale, "dashboard.centerRevenue")}
              </span>
              <div className="text-3xl font-bold text-emerald-400 mt-2">
                {formatCurrencyLocalized(totalRevenue, locale, "UZS")}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

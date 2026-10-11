import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users, BookOpen, CreditCard, Sparkles, CheckCircle2,
  ArrowRight, AlertTriangle, CalendarDays, ClipboardCheck,
  Flame, Clock, ShieldCheck, BarChart3, GraduationCap, Plus
} from "lucide-react";
import { t, formatCurrencyLocalized, formatDateLocalized } from "@/i18n";

export default async function CenterDashboardPage() {
  const tenantCtx = await requireTenantPageAccess();

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

  const center = await tenantCtx.getTenantDb().learningCenter.findUnique({
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

interface StudentEnrollmentItem {
  id: string;
  group: {
    name: string;
    course: { title: string };
    teacher?: { user: { fullName: string } } | null;
  };
}

interface ParentChildItem {
  id: string;
  student: {
    user: { fullName: string; email: string };
    enrollments: Array<{ id: string; group: { name: string; course: { title: string } } }>;
    payments: Array<{ id: string; amount: number; status: string }>;
  };
}

interface UrgentHomeworkItem {
  id: string;
  title: string;
  dueDate?: Date | null;
}

  let activeStudentsCount = 0;
  let activeTeachersCount = 0;
  let coursesCount = 0;
  let totalRevenue = 0;
  let overallAttendanceRate: number | null = null;
  let atRiskStudentsCount = 0;
  let centerScheduleSlots: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roomName?: string | null;
    group: { name: string; course: { title: string } };
    teacher: { user: { fullName: string } };
  }> = [];
  let studentEnrollments: StudentEnrollmentItem[] = [];
  let parentChildren: ParentChildItem[] = [];
  let pendingHomeworksCount = 0;
  let urgentHomeworks: UrgentHomeworkItem[] = [];
  let attendanceRate: number | null = null;

  activeStudentsCount = await tenantCtx.getTenantDb().centerMembership.count({
    where: { centerId: activeCenterId, role: "STUDENT", status: "ACTIVE" },
  });

  activeTeachersCount = await tenantCtx.getTenantDb().centerMembership.count({
    where: { centerId: activeCenterId, role: "TEACHER", status: "ACTIVE" },
  });

  coursesCount = await tenantCtx.getTenantDb().course.count({
    where: { centerId: activeCenterId },
  });

  const payments = await tenantCtx.getTenantDb().centerPayment.aggregate({
    where: { centerId: activeCenterId, status: "PAID" },
    _sum: { amount: true },
  });
  totalRevenue = payments._sum.amount || 0;

  // Director / Admin specific attendance analytics and upcoming schedule
  if (activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN") {
    const centerAttendances = await tenantCtx.getTenantDb().attendance.findMany({
      where: { lesson: { module: { course: { centerId: activeCenterId } } } },
      select: { studentMembershipId: true, status: true },
    });
    const totalCenterAtt = centerAttendances.length;
    const presentCenterAtt = centerAttendances.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    overallAttendanceRate =
      totalCenterAtt > 0 ? Math.round((presentCenterAtt / totalCenterAtt) * 100) : null;

    const studentAttMap = new Map<string, { total: number; present: number }>();
    for (const a of centerAttendances) {
      const cur = studentAttMap.get(a.studentMembershipId) || { total: 0, present: 0 };
      cur.total++;
      if (a.status === "PRESENT" || a.status === "LATE") cur.present++;
      studentAttMap.set(a.studentMembershipId, cur);
    }
    for (const [, stats] of studentAttMap) {
      if (stats.total > 0 && stats.present / stats.total < 0.8) {
        atRiskStudentsCount++;
      }
    }

    centerScheduleSlots = await tenantCtx.getTenantDb().scheduleSlot.findMany({
      where: { centerId: activeCenterId, status: "ACTIVE" },
      include: {
        group: { include: { course: { select: { title: true } } } },
        teacher: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      take: 6,
    });
  }

  // Teacher specific schedule and pending homework reviews
  interface TeacherScheduleSlotItem {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roomName?: string | null;
    groupId: string;
    group: { name: string; course: { title: string } };
  }

  interface PendingReviewItem {
    id: string;
    studentName: string;
    homeworkTitle: string;
    submittedAt: Date;
  }

  let teacherScheduleSlots: TeacherScheduleSlotItem[] = [];
  let pendingReviewsList: PendingReviewItem[] = [];

  if (activeRole === "TEACHER") {
    const teacherMem = session.memberships.find((m) => m.centerId === activeCenterId);
    if (teacherMem) {
      teacherScheduleSlots = await tenantCtx.getTenantDb().scheduleSlot.findMany({
        where: {
          centerId: activeCenterId,
          teacherMembershipId: teacherMem.id,
          status: "ACTIVE",
        },
        include: {
          group: { include: { course: { select: { title: true } } } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });

      pendingHomeworksCount = await tenantCtx.getTenantDb().homeworkSubmission.count({
        where: {
          homework: { lesson: { module: { course: { centerId: activeCenterId } } } },
          grade: null,
          status: "SUBMITTED",
        },
      });

      const rawSubmissions = await tenantCtx.getTenantDb().homeworkSubmission.findMany({
        where: {
          homework: { lesson: { module: { course: { centerId: activeCenterId } } } },
          grade: null,
          status: "SUBMITTED",
        },
        include: {
          student: { include: { user: { select: { fullName: true, email: true } } } },
          homework: { select: { title: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 5,
      });

      pendingReviewsList = rawSubmissions.map((s) => ({
        id: s.id,
        studentName: s.student.user.fullName || s.student.user.email,
        homeworkTitle: s.homework.title,
        submittedAt: s.submittedAt,
      }));
    }
  }

  // Student specific data
  if (activeRole === "STUDENT") {
    const studentMem = session.memberships.find((m) => m.centerId === activeCenterId);
    if (studentMem) {
      studentEnrollments = await tenantCtx.getTenantDb().enrollment.findMany({
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

      urgentHomeworks = await tenantCtx.getTenantDb().homework.findMany({
        where: {
          lesson: { module: { course: { centerId: activeCenterId } } },
          dueDate: { gte: new Date() },
        },
        take: 3,
        orderBy: { dueDate: "asc" },
      });

      const studentAttendances = await tenantCtx.getTenantDb().attendance.findMany({
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
      parentChildren = await tenantCtx.getTenantDb().parentLink.findMany({
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

      {/* Teacher View: Schedule & Pending Reviews */}
      {activeRole === "TEACHER" && (
        <div className="space-y-8">
          {/* My Schedule Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-brand-400" />
                <span>{t(locale, "dashboard.mySchedule")}</span>
              </h2>
              <Link
                href="/center/schedule"
                className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 hover:underline"
              >
                {t(locale, "dashboard.viewSchedule")}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {teacherScheduleSlots.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center space-y-2">
                <CalendarDays className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">{t(locale, "dashboard.noTeacherSchedule")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teacherScheduleSlots.map((slot) => {
                  const dayNames: Record<number, string> = {
                    1: t(locale, "schedule.monShort"),
                    2: t(locale, "schedule.tueShort"),
                    3: t(locale, "schedule.wedShort"),
                    4: t(locale, "schedule.thuShort"),
                    5: t(locale, "schedule.friShort"),
                    6: t(locale, "schedule.satShort"),
                    7: t(locale, "schedule.sunShort"),
                  };
                  return (
                    <div
                      key={slot.id}
                      className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                            {dayNames[slot.dayOfWeek] || `День ${slot.dayOfWeek}`} • {slot.startTime} - {slot.endTime}
                          </span>
                          {slot.roomName && (
                            <span className="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {slot.roomName}
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-white line-clamp-1">{slot.group.course.title}</h4>
                        <p className="text-xs text-emerald-400 font-semibold">{slot.group.name}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <Link
                          href={`/center/attendance?groupId=${slot.groupId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>{t(locale, "dashboard.quickAttendance")}</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Reviews Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>{t(locale, "dashboard.pendingReviews")}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                  {pendingHomeworksCount}
                </span>
              </h2>
              <Link
                href="/center/homework?status=SUBMITTED"
                className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 hover:underline"
              >
                {t(locale, "nav.homework")}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {pendingReviewsList.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-emerald-300">{t(locale, "dashboard.noPendingReviews")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingReviewsList.map((rev) => (
                  <div
                    key={rev.id}
                    className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>{formatDateLocalized(rev.submittedAt, locale)}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">
                          {t(locale, "homework.submitted")}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white line-clamp-1">{rev.homeworkTitle}</h4>
                      <p className="text-xs text-slate-300 font-medium mt-1">
                        {t(locale, "dashboard.submissionFrom", { name: rev.studentName })}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <Link
                        href="/center/homework?status=SUBMITTED"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 hover:underline"
                      >
                        <span>{t(locale, "dashboard.reviewAction")}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
              {studentEnrollments.map((en) => (
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
            parentChildren.map((link) => (
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
                      {link.student.enrollments.map((e) => (
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
                      {link.student.payments.map((p) => (
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

      {/* Director & Admin Dashboard */}
      {(activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN") && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
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

          {/* Attendance Summary & Quality Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t(locale, "dashboard.centerAttendanceRate")}
                  </span>
                  <div className="text-2xl font-extrabold text-white mt-1">
                    {overallAttendanceRate !== null ? `${overallAttendanceRate}%` : "—"}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>

              {overallAttendanceRate !== null && (
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      overallAttendanceRate >= 80 ? "bg-emerald-500" : "bg-red-500"
                    }`}
                    style={{ width: `${overallAttendanceRate}%` }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">{t(locale, "attendance.title")}</span>
                <Link
                  href="/center/attendance"
                  className="text-brand-400 hover:text-brand-300 font-medium hover:underline flex items-center gap-1"
                >
                  {t(locale, "dashboard.viewAttendanceJournal")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t(locale, "dashboard.atRiskCount")}
                  </span>
                  <div className={`text-2xl font-extrabold mt-1 ${atRiskStudentsCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                    {atRiskStudentsCount}
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${atRiskStudentsCount > 0 ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              <p className="text-xs text-slate-400">
                {atRiskStudentsCount > 0
                  ? "Студенты с посещаемостью ниже 80% требуют внимания преподавателей и родителей."
                  : "Все активные студенты имеют удовлетворительный уровень посещаемости."}
              </p>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">{t(locale, "attendance.riskList")}</span>
                <Link
                  href="/center/attendance"
                  className="text-brand-400 hover:text-brand-300 font-medium hover:underline flex items-center gap-1"
                >
                  {t(locale, "dashboard.viewAttendanceJournal")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Upcoming Center Schedule */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-brand-400" />
                <span>{t(locale, "dashboard.upcomingCenterSchedule")}</span>
              </h2>
              <Link
                href="/center/schedule"
                className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 hover:underline"
              >
                {t(locale, "dashboard.viewSchedule")}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {centerScheduleSlots.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center space-y-3">
                <CalendarDays className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">{t(locale, "dashboard.noUpcomingClasses")}</p>
                <Link
                  href="/center/schedule"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {t(locale, "dashboard.setupSchedulePrompt")}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {centerScheduleSlots.map((slot) => {
                  const dayNames: Record<number, string> = {
                    1: t(locale, "schedule.monShort"),
                    2: t(locale, "schedule.tueShort"),
                    3: t(locale, "schedule.wedShort"),
                    4: t(locale, "schedule.thuShort"),
                    5: t(locale, "schedule.friShort"),
                    6: t(locale, "schedule.satShort"),
                    7: t(locale, "schedule.sunShort"),
                  };
                  return (
                    <div
                      key={slot.id}
                      className="glass-panel p-4 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                          {dayNames[slot.dayOfWeek] || `День ${slot.dayOfWeek}`} • {slot.startTime} - {slot.endTime}
                        </span>
                        {slot.roomName && (
                          <span className="text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {slot.roomName}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white line-clamp-1">{slot.group.course.title}</h4>
                        <p className="text-xs text-brand-400 font-medium mt-0.5">{slot.group.name}</p>
                      </div>
                      <div className="text-xs text-slate-400 border-t border-slate-800/60 pt-2 flex items-center justify-between">
                        <span>{slot.teacher.user.fullName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Helpful Empty State Banners */}
          {coursesCount === 0 && (
            <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-brand-400 shrink-0" />
                <p className="text-xs text-slate-300">{t(locale, "dashboard.noCoursesYet")}</p>
              </div>
              <Link
                href="/center/courses"
                className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-xl transition-all shrink-0 text-center"
              >
                {t(locale, "dashboard.createFirstCourse")}
              </Link>
            </div>
          )}

          {activeStudentsCount === 0 && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-xs text-slate-300">{t(locale, "dashboard.noActiveStudents")}</p>
              </div>
              <Link
                href="/center/students"
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shrink-0 text-center"
              >
                {t(locale, "dashboard.addStudentsPrompt")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

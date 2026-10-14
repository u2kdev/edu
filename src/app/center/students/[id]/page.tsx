import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Users,
  GraduationCap,
  ClipboardCheck,
  CreditCard,
  History,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";
import { t } from "@/i18n";

export default async function StudentProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const studentMembershipId = params.id;
  const currentRole = session.activeCenterRole || "";
  const locale = session.user.preferredLanguage || "ru";

  const tenantDb = tenantCtx.getTenantDb();

  // Find student in this center
  const student = await tenantDb.centerMembership.findFirst({
    where: {
      id: studentMembershipId,
      centerId: tenantCtx.center.id,
      role: "STUDENT",
    },
    include: {
      user: true,
      enrollments: {
        include: {
          group: {
            include: {
              course: { select: { title: true } },
              teacher: {
                include: { user: { select: { fullName: true } } },
              },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      },
      parentLinksAsStudent: {
        where: { status: "CONFIRMED" },
        include: {
          parent: {
            include: {
              user: {
                select: { fullName: true, phone: true, email: true },
              },
            },
          },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!student) {
    redirect("/center/students");
  }

  // Security role checks:
  if (currentRole === "STUDENT") {
    if (tenantCtx.membership?.id !== studentMembershipId) {
      redirect("/center");
    }
  } else if (currentRole === "PARENT") {
    const parentLink = await tenantDb.parentLink.findFirst({
      where: {
        parentMembershipId: tenantCtx.membership?.id,
        studentMembershipId: studentMembershipId,
        status: "CONFIRMED",
      },
    });
    if (!parentLink && !tenantCtx.isPlatformStaff) {
      redirect("/center");
    }
  } else if (currentRole === "TEACHER") {
    const teacherEnrolled = await tenantDb.enrollment.findFirst({
      where: {
        studentMembershipId: studentMembershipId,
        group: { teacherMembershipId: tenantCtx.membership?.id },
      },
    });
    if (!teacherEnrolled && !tenantCtx.isPlatformStaff) {
      redirect("/center");
    }
  } else if (
    currentRole !== "DIRECTOR" &&
    currentRole !== "CENTER_ADMIN" &&
    !tenantCtx.isPlatformStaff
  ) {
    redirect("/center");
  }

  // Load attendances
  const attendances = await tenantDb.attendance.findMany({
    where: { studentMembershipId },
    orderBy: { markedAt: "desc" },
    take: 30,
    include: {
      lesson: { select: { title: true, scheduledAt: true } },
    },
  });

  // Load grades
  const grades = await tenantDb.grade.findMany({
    where: { studentMembershipId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      lesson: { select: { title: true } },
      teacher: { include: { user: { select: { fullName: true } } } },
    },
  });

  // Load audit logs (enrollment / transfer / drop history)
  const auditLogs = await tenantDb.auditLog.findMany({
    where: {
      centerId: tenantCtx.center.id,
      resource: "Student",
      resourceId: studentMembershipId,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/center/students"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t(locale, "common.back")}</span>
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <User className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {student.user.fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1 font-mono">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                {student.user.email}
              </span>
              {student.user.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {student.user.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {new Date(student.joinedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
          {student.status === "ACTIVE"
            ? t(locale, "students.statusActive")
            : t(locale, "students.statusArchived")}
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Groups & Enrolled Courses */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" />
            <span>{t(locale, "students.groups")}</span>
          </h2>
          {student.enrollments.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              {t(locale, "students.noGroups")}
            </p>
          ) : (
            <div className="space-y-2.5">
              {student.enrollments.map((en) => (
                <div
                  key={en.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <h3 className="font-semibold text-white">{en.group.name}</h3>
                    <p className="text-[11px] text-brand-400">
                      {en.group.course.title}
                    </p>
                    {en.group.teacher && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t(locale, "students.teacherLabel", {
                          name: en.group.teacher.user.fullName,
                        })}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      en.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {en.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Parents Linked */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-brand-400" />
            <span>{t(locale, "students.parents")}</span>
          </h2>
          {student.parentLinksAsStudent.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              {t(locale, "students.noParents")}
            </p>
          ) : (
            <div className="space-y-2.5">
              {student.parentLinksAsStudent.map((link) => (
                <div
                  key={link.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <h3 className="font-semibold text-white">
                      {link.parent.user.fullName}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {link.parent.user.email}
                    </p>
                    {link.parent.user.phone && (
                      <p className="text-[11px] text-slate-500 font-mono">
                        {link.parent.user.phone}
                      </p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-semibold">
                    {t(locale, "common.yes")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance Summary */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            <span>{t(locale, "students.attendanceSummary")}</span>
          </h2>
          {attendances.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              {t(locale, "common.noData")}
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {attendances.map((att) => (
                <div
                  key={att.id}
                  className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <h3 className="font-semibold text-white">{att.lesson.title}</h3>
                    <p className="text-[10px] text-slate-500">
                      {new Date(att.markedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      att.status === "PRESENT"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : att.status === "LATE"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {att.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grades Summary */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-brand-400" />
            <span>{t(locale, "students.gradesSummary")}</span>
          </h2>
          {grades.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              {t(locale, "common.noData")}
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {grades.map((g) => (
                <div
                  key={g.id}
                  className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <h3 className="font-semibold text-white">
                      {g.lesson?.title || t(locale, "students.lessonFallback")}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      {g.teacher?.user.fullName} &bull;{" "}
                      {new Date(g.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400 text-sm">
                      {g.value} / {g.maxValue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments (Read Only) */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-400" />
            <span>{t(locale, "students.payments")}</span>
          </h2>
          {student.payments.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              {t(locale, "students.noPayments")}
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {student.payments.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <h3 className="font-semibold text-white">
                      {p.amount.toLocaleString()} {p.currency}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      {p.paymentMethod} &bull;{" "}
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      p.status === "PAID"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Enrollment and Transfer History (Audit Logs) */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-brand-400" />
            <span>{t(locale, "students.enrollmentHistory")}</span>
          </h2>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              {t(locale, "students.noHistory")}
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {auditLogs.map((log) => {
                let parsedDetails = null;
                try {
                  parsedDetails = log.detailsJson ? JSON.parse(log.detailsJson) : null;
                } catch {
                  // ignore
                }

                return (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono text-[11px]">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {parsedDetails && (
                      <div className="text-[11px] text-slate-400">
                        {parsedDetails.fromGroupName && parsedDetails.toGroupName && (
                          <p>
                            {t(locale, "students.transferHistory", {
                              from: parsedDetails.fromGroupName,
                              to: parsedDetails.toGroupName,
                            })}
                          </p>
                        )}
                        {parsedDetails.reason && (
                          <p className="italic text-slate-500">
                            {t(locale, "students.reasonLabel", {
                              reason: parsedDetails.reason,
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

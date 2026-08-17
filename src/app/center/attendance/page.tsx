import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ClipboardCheck, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";

export default async function CenterAttendancePage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const activeRole = session.activeCenterRole || "";
  const currentMembership = session.memberships.find(m => m.centerId === centerId);

  let whereCondition: any = {
    lesson: { module: { course: { centerId } } },
  };

  if (activeRole === "STUDENT" && currentMembership) {
    whereCondition.studentMembershipId = currentMembership.id;
  } else if (activeRole === "PARENT" && currentMembership) {
    const childLinks = await db.parentLink.findMany({
      where: { parentMembershipId: currentMembership.id, status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    whereCondition.studentMembershipId = { in: childLinks.map(l => l.studentMembershipId) };
  } else if (activeRole === "TEACHER" && currentMembership) {
    whereCondition.student = {
      enrollments: {
        some: {
          group: { teacherMembershipId: currentMembership.id },
        },
      },
    };
  }

  const attendances = await db.attendance.findMany({
    where: whereCondition,
    include: {
      lesson: { select: { title: true, scheduledAt: true } },
      student: { include: { user: { select: { fullName: true, email: true } } } },
    },
    orderBy: { markedAt: "desc" },
    take: 50,
  });

  const statusBadges: Record<string, { labelKey: string; color: string }> = {
    PRESENT: { labelKey: "attendance.present", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    ABSENT: { labelKey: "attendance.absent", color: "bg-red-500/10 text-red-400 border-red-500/20" },
    EXCUSED: { labelKey: "attendance.excused", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    LATE: { labelKey: "attendance.late", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{t(locale, "attendance.title")}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{t(locale, "attendance.attendanceRate")}</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-4">{t(locale, "nav.students")}</th>
              <th className="p-4">{t(locale, "lessons.title")}</th>
              <th className="p-4">{t(locale, "common.status")}</th>
              <th className="p-4">{t(locale, "common.date")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {attendances.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  {t(locale, "common.noData")}
                </td>
              </tr>
            ) : (
              attendances.map((att) => {
                const badge = statusBadges[att.status] || { labelKey: att.status, color: "text-slate-400" };
                return (
                  <tr key={att.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-4 font-semibold text-white">
                      {att.student.user.fullName}
                    </td>
                    <td className="p-4 text-slate-300">
                      {att.lesson.title}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                        {t(locale, badge.labelKey)}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {formatDateLocalized(att.markedAt, locale)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

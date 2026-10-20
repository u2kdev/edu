import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { t, formatDateLocalized } from "@/i18n";
import { Prisma } from "@prisma/client";
import AttendanceManager from "@/components/AttendanceManager";

export default async function CenterAttendancePage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const activeRole = session.activeCenterRole || "";
  const currentMembership = session.memberships.find((m) => m.centerId === centerId);

  // Platform staff (DEVELOPER / SUPERADMIN / PLATFORM_SUPPORT) may browse any center.
  const isPlatformStaff =
    tenantCtx.isPlatformStaff || session.user.platformRole === "SUPERADMIN";
  // The center-wide scope is reserved for management and platform staff.
  const isCenterWide =
    activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN" || isPlatformStaff;
  const hasOwnGroups =
    (activeRole === "TEACHER" || activeRole === "TEACHER_ASSISTANT") &&
    Boolean(currentMembership);

  // Only staff with a real group scope may load groups/lessons/students for the
  // AttendanceManager: management/platform staff (all groups) or teachers with
  // their own groups. Everyone else loads nothing.
  let groups: { id: string; name: string }[] = [];
  const lessonsByGroup: Record<string, { id: string; title: string; scheduledAt: string | null }[]> = {};
  const studentsByGroup: Record<string, { id: string; fullName: string; email: string }[]> = {};

  if (isCenterWide || hasOwnGroups) {
    const groupsWhere: Prisma.GroupWhereInput = { centerId };
    if (activeRole === "TEACHER" && currentMembership) {
      groupsWhere.teacherMembershipId = currentMembership.id;
    } else if (activeRole === "TEACHER_ASSISTANT" && currentMembership) {
      groupsWhere.assistantMembershipId = currentMembership.id;
    }

    const rawGroups = await tenantCtx.getTenantDb().group.findMany({
      where: groupsWhere,
      include: {
        course: {
          include: {
            modules: {
              include: {
                lessons: { select: { id: true, title: true, scheduledAt: true } },
              },
            },
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            student: {
              include: { user: { select: { fullName: true, email: true } } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    groups = rawGroups.map((g) => ({ id: g.id, name: g.name }));
    for (const g of rawGroups) {
      const allLessons = g.course.modules.flatMap((m) =>
        m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          scheduledAt: l.scheduledAt ? l.scheduledAt.toISOString() : null,
        }))
      );
      lessonsByGroup[g.id] = allLessons;
      studentsByGroup[g.id] = g.enrollments.map((e) => ({
        id: e.student.id,
        fullName: e.student.user.fullName || e.student.user.email,
        email: e.student.user.email,
      }));
    }
  }

  // SECURITY: fail-closed role scope. The default is "nothing"; only the
  // explicit branches below widen it. No role can silently fall through to the
  // whole center.
  let whereCondition: Prisma.AttendanceWhereInput = { id: { in: [] } };

  if (isCenterWide) {
    whereCondition = {
      lesson: { module: { course: { centerId } } },
    };
  } else if (activeRole === "STUDENT" && currentMembership) {
    whereCondition = {
      lesson: { module: { course: { centerId } } },
      studentMembershipId: currentMembership.id,
    };
  } else if (activeRole === "PARENT" && currentMembership) {
    const childLinks = await tenantCtx.getTenantDb().parentLink.findMany({
      where: { parentMembershipId: currentMembership.id, status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    whereCondition = {
      lesson: { module: { course: { centerId } } },
      studentMembershipId: { in: childLinks.map((l) => l.studentMembershipId) },
    };
  } else if (activeRole === "TEACHER" && currentMembership) {
    whereCondition = {
      lesson: { module: { course: { centerId } } },
      student: {
        enrollments: {
          some: {
            group: { teacherMembershipId: currentMembership.id },
          },
        },
      },
    };
  } else if (activeRole === "TEACHER_ASSISTANT" && currentMembership) {
    whereCondition = {
      lesson: { module: { course: { centerId } } },
      student: {
        enrollments: {
          some: {
            group: { assistantMembershipId: currentMembership.id },
          },
        },
      },
    };
  }

  const attendances = await tenantCtx.getTenantDb().attendance.findMany({
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
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">{t(locale, "attendance.title")}</h2>
        <p className="text-sm text-slate-400 mt-0.5">{t(locale, "attendance.attendanceRate")}</p>
      </div>

      {groups.length > 0 && (
        <AttendanceManager
          groups={groups}
          lessonsByGroup={lessonsByGroup}
          studentsByGroup={studentsByGroup}
          locale={locale}
          userRole={activeRole}
        />
      )}

      {/* History log */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">
          {t(locale, "reports.attendanceSummary") || "История отметок"}
        </h3>
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
    </div>
  );
}

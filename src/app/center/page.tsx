import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { t } from "@/i18n";
import { PARENT_CHILD_COOKIE } from "@/lib/sidebar-constants";
import type { AnalyticsPeriodPreset } from "@/lib/finance-analytics";
import { getCenterFinanceAnalytics } from "@/lib/finance-analytics";
import {
  getDirectorDashboardData,
  getStudentPerformanceData,
  getTeacherDashboardData,
} from "@/lib/dashboard-analytics";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { DirectorDashboardView } from "@/components/dashboard/DirectorDashboardView";
import { TeacherDashboardView } from "@/components/dashboard/TeacherDashboardView";
import { StudentDashboardView } from "@/components/dashboard/StudentDashboardView";
import {
  ParentDashboardView,
  type ParentChildDashboardEntry,
} from "@/components/dashboard/ParentDashboardView";
import { CenterFinanceAnalytics } from "@/components/finance/CenterFinanceAnalytics";

export const dynamic = "force-dynamic";

function normalizePeriod(raw?: string): AnalyticsPeriodPreset {
  if (raw === "7d" || raw === "30d" || raw === "90d" || raw === "12m") return raw;
  return "30d";
}

export default async function CenterDashboardPage({
  searchParams,
}: {
  searchParams?: { period?: string; childId?: string };
}) {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage || "ru";
  const activeCenterId = session.activeCenterId;
  const activeRole = session.activeCenterRole || "";

  if (!activeCenterId) {
    return (
      <div className="py-12">
        <EmptyState title={t(locale, "dashboard.selectCenter")} locale={locale} />
      </div>
    );
  }

  const tenantDb = tenantCtx.getTenantDb();
  const center = await tenantDb.learningCenter.findUnique({
    where: { id: activeCenterId },
    select: { id: true, name: true, slug: true, status: true },
  });

  if (!center) redirect("/login");

  const period = normalizePeriod(searchParams?.period);
  const currentMem = session.memberships.find((m) => m.centerId === activeCenterId);
  const roleLabel = activeRole ? t(locale, `roles.${activeRole}`) : "";

  if (activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN") {
    const directorData = await getDirectorDashboardData({
      centerId: activeCenterId,
      period,
    });
    return (
      <DirectorDashboardView
        data={directorData}
        roleLabel={roleLabel}
        centerSlug={center.slug}
        locale={locale}
      />
    );
  }

  if (activeRole === "ACCOUNTANT") {
    const financeAnalytics = await getCenterFinanceAnalytics({
      centerId: activeCenterId,
      period,
    });
    return (
      <div className="space-y-6">
        <PageHeader
          title={t(locale, "ui3.accountantOverviewTitle")}
          description={`${t(locale, "ui3.accountantOverviewSubtitle")} (${center.slug})`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/center/finance">{t(locale, "nav.finance")}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/center/reports">{t(locale, "nav.reports")}</Link>
              </Button>
            </div>
          }
        />
        <CenterFinanceAnalytics initialData={financeAnalytics} locale={locale} />
      </div>
    );
  }

  if (activeRole === "TEACHER" || activeRole === "TEACHER_ASSISTANT") {
    const emptyTeacherData = {
      period,
      kpis: {
        todayLessonsCount: 0,
        pendingReviewsCount: 0,
        unmarkedLessonsCount: 0,
        groupsCount: 0,
        avgAttendanceRate: null,
        atRiskCount: 0,
        monthlyHours: 0,
        monthlyCalculatedSalary: 0,
        monthlyUnpaidSalary: 0,
      },
      todayLessons: [],
      weeklySchedule: [],
      attendanceByGroup: [],
      pendingReviews: [],
      gradeDistribution: [],
      atRiskStudents: [],
      salarySummary: {
        conductedLessons: 0,
        totalMinutes: 0,
        totalHours: 0,
        calculatedSalary: 0,
        paidSalary: 0,
        unpaidSalary: 0,
      },
    };

    const teacherData = currentMem
      ? await getTeacherDashboardData({
          centerId: activeCenterId,
          membershipId: currentMem.id,
          role: activeRole,
          period,
        })
      : emptyTeacherData;

    return (
      <TeacherDashboardView
        data={teacherData}
        roleLabel={roleLabel}
        centerSlug={center.slug}
        locale={locale}
      />
    );
  }

  if (activeRole === "STUDENT") {
    if (!currentMem) {
      return (
        <StudentDashboardView
          performance={null}
          enrollmentsCount={0}
          scheduleSlots={[]}
          centerSlug={center.slug}
          locale={locale}
        />
      );
    }

    const enrollments = await tenantDb.enrollment.findMany({
      where: { studentMembershipId: currentMem.id, status: "ACTIVE" },
      select: { groupId: true },
    });
    const enrolledGroupIds = enrollments.map((e) => e.groupId);

    const [performance, scheduleSlots] = await Promise.all([
      enrollments.length > 0
        ? getStudentPerformanceData({
            centerId: activeCenterId,
            studentMembershipId: currentMem.id,
            viewerRole: "STUDENT",
            viewerMembershipId: currentMem.id,
            period,
          })
        : Promise.resolve(null),
      enrolledGroupIds.length > 0
        ? tenantDb.scheduleSlot.findMany({
            where: {
              centerId: activeCenterId,
              groupId: { in: enrolledGroupIds },
              status: "ACTIVE",
            },
            include: {
              group: { include: { course: { select: { title: true } } } },
              teacher: { include: { user: { select: { fullName: true } } } },
            },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
            take: 6,
          })
        : Promise.resolve([]),
    ]);

    return (
      <StudentDashboardView
        performance={performance}
        enrollmentsCount={enrollments.length}
        scheduleSlots={scheduleSlots.map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          roomName: s.roomName ?? null,
          groupName: s.group.name,
          courseTitle: s.group.course.title,
          teacherName: s.teacher.user.fullName,
        }))}
        centerSlug={center.slug}
        locale={locale}
      />
    );
  }

  if (activeRole === "PARENT") {
    let initialSelectedChildId: string | null = searchParams?.childId || null;
    try {
      if (!initialSelectedChildId) {
        initialSelectedChildId = cookies().get(PARENT_CHILD_COOKIE)?.value || null;
      }
    } catch {
      // Ignore outside request context
    }

    const childrenData: ParentChildDashboardEntry[] = [];
    if (currentMem) {
      const links = await tenantDb.parentLink.findMany({
        where: { parentMembershipId: currentMem.id, status: "CONFIRMED" },
        include: {
          student: {
            select: {
              id: true,
              user: { select: { fullName: true, email: true } },
            },
          },
        },
      });

      const perfList = await Promise.all(
        links.map((link) =>
          getStudentPerformanceData({
            centerId: activeCenterId,
            studentMembershipId: link.student.id,
            viewerRole: "PARENT",
            viewerMembershipId: currentMem.id,
            period,
          }).then((performance) => ({
            studentMembershipId: link.student.id,
            fullName: link.student.user.fullName,
            email: link.student.user.email.endsWith("@noemail.local")
              ? null
              : link.student.user.email,
            performance,
          }))
        )
      );
      childrenData.push(...perfList);
    }

    return (
      <ParentDashboardView
        childrenData={childrenData}
        initialSelectedChildId={initialSelectedChildId}
        centerSlug={center.slug}
        locale={locale}
      />
    );
  }

  // Fallback for CENTER_SUPPORT / administrative roles
  const [activeStudentsCount, activeTeachersCount, coursesCount] = await Promise.all([
    tenantDb.centerMembership.count({
      where: { centerId: activeCenterId, role: "STUDENT", status: "ACTIVE" },
    }),
    tenantDb.centerMembership.count({
      where: { centerId: activeCenterId, role: "TEACHER", status: "ACTIVE" },
    }),
    tenantDb.course.count({ where: { centerId: activeCenterId } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t(locale, "ui3.supportOverviewTitle")}`}
        description={`${t(locale, "ui3.supportOverviewSubtitle")} (${center.slug})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/center/students">{t(locale, "nav.students")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/center/support">{t(locale, "nav.support")}</Link>
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "dashboard.activeStudents")} value={activeStudentsCount} />
        <StatCard label={t(locale, "dashboard.teachers")} value={activeTeachersCount} />
        <StatCard label={t(locale, "dashboard.totalCourses")} value={coursesCount} />
      </div>
    </div>
  );
}

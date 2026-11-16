import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GraduationCap, Award } from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";
import { Prisma } from "@prisma/client";
import GradebookManager from "@/components/GradebookManager";
import { getSelectedParentChildIds } from "@/lib/parent-child";
import {
  getStudentPerformanceData,
  type StudentPerformanceDTO,
} from "@/lib/dashboard-analytics";
import type { AnalyticsPeriodPreset } from "@/lib/finance-analytics";
import { StudentPerformanceView } from "@/components/students/StudentPerformanceView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function normalizePeriod(raw?: string): AnalyticsPeriodPreset {
  if (raw === "7d" || raw === "30d" || raw === "90d" || raw === "12m") return raw;
  return "30d";
}

export default async function CenterGradesPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const activeRole = session.activeCenterRole || "";
  const period = normalizePeriod(searchParams?.period);

  // Get the current user's membership in this center
  const currentMembership = session.memberships.find((m) => m.centerId === centerId);

  // Platform staff (DEVELOPER / SUPERADMIN / PLATFORM_SUPPORT) may browse any center.
  const isPlatformStaff =
    tenantCtx.isPlatformStaff || session.user.platformRole === "SUPERADMIN";
  // The center-wide scope is reserved for management and platform staff.
  const isCenterWide =
    activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN" || isPlatformStaff;

  // SECURITY: Build WHERE clause scoped by role.
  const emptyScope = { id: { in: [] as string[] } };

  let submissionsWhere: Prisma.HomeworkSubmissionWhereInput;
  let testAttemptsWhere: Prisma.TestAttemptWhereInput;
  let selectedChildIds: string[] = [];

  if (isCenterWide) {
    submissionsWhere = {
      homework: { lesson: { module: { course: { centerId } } } },
      grade: { not: null },
    };
    testAttemptsWhere = {
      test: { material: { centerId } },
    };
  } else if (
    (activeRole === "TEACHER" || activeRole === "TEACHER_ASSISTANT") &&
    currentMembership
  ) {
    const groupScope =
      activeRole === "TEACHER_ASSISTANT"
        ? { assistantMembershipId: currentMembership.id }
        : { teacherMembershipId: currentMembership.id };
    submissionsWhere = {
      homework: { lesson: { module: { course: { centerId } } } },
      grade: { not: null },
      student: {
        enrollments: {
          some: {
            group: groupScope,
          },
        },
      },
    };
    testAttemptsWhere = {
      test: { material: { centerId } },
      student: {
        enrollments: {
          some: {
            group: groupScope,
          },
        },
      },
    };
  } else if (activeRole === "STUDENT" && currentMembership) {
    submissionsWhere = {
      homework: { lesson: { module: { course: { centerId } } } },
      grade: { not: null },
      studentMembershipId: currentMembership.id,
    };
    testAttemptsWhere = {
      test: { material: { centerId } },
      studentMembershipId: currentMembership.id,
    };
  } else if (activeRole === "PARENT" && currentMembership) {
    const childLinks = await tenantCtx.getTenantDb().parentLink.findMany({
      where: { parentMembershipId: currentMembership.id, status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    selectedChildIds = getSelectedParentChildIds(
      childLinks.map((l) => l.studentMembershipId)
    );
    submissionsWhere = {
      homework: { lesson: { module: { course: { centerId } } } },
      grade: { not: null },
      studentMembershipId: { in: selectedChildIds },
    };
    testAttemptsWhere = {
      test: { material: { centerId } },
      studentMembershipId: { in: selectedChildIds },
    };
  } else {
    submissionsWhere = emptyScope;
    testAttemptsWhere = emptyScope;
  }

  const submissions = await tenantCtx.getTenantDb().homeworkSubmission.findMany({
    where: submissionsWhere,
    include: {
      homework: { select: { title: true } },
      student: { include: { user: { select: { fullName: true, email: true } } } },
    },
    orderBy: { gradedAt: "desc" },
    take: 50,
  });

  const testAttempts = await tenantCtx.getTenantDb().testAttempt.findMany({
    where: testAttemptsWhere,
    include: {
      test: { include: { material: { select: { title: true } } } },
      student: { include: { user: { select: { fullName: true, email: true } } } },
    },
    orderBy: { completedAt: "desc" },
    take: 50,
  });

  const totalGraded = submissions.filter((s) => s.grade !== null).length;
  const avgGrade =
    totalGraded > 0
      ? Math.round(
          submissions.reduce((sum, s) => sum + (s.grade || 0), 0) / totalGraded
        )
      : 0;

  let groups: { id: string; name: string }[] = [];
  const hasOwnGroups =
    (activeRole === "TEACHER" || activeRole === "TEACHER_ASSISTANT") &&
    Boolean(currentMembership);
  if (isCenterWide || hasOwnGroups) {
    const groupsWhere: Prisma.GroupWhereInput = { centerId };
    if (activeRole === "TEACHER" && currentMembership) {
      groupsWhere.teacherMembershipId = currentMembership.id;
    } else if (activeRole === "TEACHER_ASSISTANT" && currentMembership) {
      groupsWhere.assistantMembershipId = currentMembership.id;
    }
    const rawGroups = await tenantCtx.getTenantDb().group.findMany({
      where: groupsWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    groups = rawGroups;
  }

  let performanceData: StudentPerformanceDTO | null = null;
  if (!isPlatformStaff && currentMembership) {
    if (activeRole === "STUDENT") {
      performanceData = await getStudentPerformanceData({
        centerId,
        studentMembershipId: currentMembership.id,
        viewerRole: "STUDENT",
        viewerMembershipId: currentMembership.id,
        period,
      });
    } else if (activeRole === "PARENT" && selectedChildIds.length > 0) {
      performanceData = await getStudentPerformanceData({
        centerId,
        studentMembershipId: selectedChildIds[0],
        viewerRole: "PARENT",
        viewerMembershipId: currentMembership.id,
        period,
      });
    }
  }

  const pageTitle =
    activeRole === "STUDENT" || activeRole === "PARENT"
      ? t(locale, "ui3.performanceTitle")
      : t(locale, "nav.grades");

  const pageSubtitle =
    activeRole === "TEACHER"
      ? t(locale, "grades.teacherDescription")
      : activeRole === "STUDENT"
      ? t(locale, "grades.studentDescription")
      : activeRole === "PARENT"
      ? t(locale, "grades.parentDescription")
      : t(locale, "grades.allDescription");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{pageSubtitle}</p>
        </div>
        {totalGraded > 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-2.5 text-right shrink-0">
            <div className="text-xs font-medium text-muted-foreground">
              {t(locale, "grades.averageScore")}
            </div>
            <div
              className={`font-display text-2xl font-semibold mt-0.5 tabular-nums ${
                avgGrade >= 70
                  ? "text-success"
                  : avgGrade >= 50
                  ? "text-warning"
                  : "text-destructive"
              }`}
            >
              {avgGrade}%
            </div>
          </div>
        )}
      </div>

      {/* Unified Student / Parent Performance Breakdown (Section E) */}
      {performanceData && (
        <StudentPerformanceView
          initialData={performanceData}
          locale={locale}
          showPeriodControls
          paymentsHref="/center/payments"
        />
      )}

      {/* Gradebook Matrix Component for Staff */}
      {groups.length > 0 && (
        <GradebookManager
          groups={groups}
          locale={locale}
          userRole={activeRole}
        />
      )}

      {/* Test Attempts Grades Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{t(locale, "materials.testDescription")}</span>
          </CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t(locale, "common.recordsCount", { count: testAttempts.length })}
          </span>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(locale, "nav.students")}</TableHead>
                <TableHead>{t(locale, "materials.test")}</TableHead>
                <TableHead>{t(locale, "performance.title")} (%)</TableHead>
                <TableHead>{t(locale, "common.status")}</TableHead>
                <TableHead>{t(locale, "common.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testAttempts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Award className="h-6 w-6 opacity-60" aria-hidden="true" />
                      <span className="text-sm">{t(locale, "common.noData")}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                testAttempts.map((att) => {
                  const isPassed =
                    (att.scorePercent || 0) >= att.test.passingScorePercent;
                  return (
                    <TableRow key={att.id}>
                      <TableCell className="font-medium text-foreground">
                        {att.student.user.fullName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {att.test.material.title}
                      </TableCell>
                      <TableCell className="font-semibold text-primary tabular-nums">
                        {att.scorePercent}% ({att.scorePoints}/{att.maxPoints})
                      </TableCell>
                      <TableCell>
                        <Badge variant={isPassed ? "success" : "destructive"}>
                          {isPassed
                            ? t(locale, "grades.passed")
                            : t(locale, "grades.failed")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateLocalized(att.completedAt, locale)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Homework Grades Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-success" aria-hidden="true" />
            <span>{t(locale, "homework.title")}</span>
          </CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t(locale, "common.recordsCount", { count: submissions.length })}
          </span>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(locale, "nav.students")}</TableHead>
                <TableHead>{t(locale, "homework.title")}</TableHead>
                <TableHead>{t(locale, "performance.title")}</TableHead>
                <TableHead>{t(locale, "homework.feedback")}</TableHead>
                <TableHead>{t(locale, "common.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <GraduationCap className="h-6 w-6 opacity-60" aria-hidden="true" />
                      <span className="text-sm">{t(locale, "common.noData")}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium text-foreground">
                      {sub.student.user.fullName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.homework.title}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-semibold tabular-nums ${
                          (sub.grade || 0) >= 70
                            ? "text-success"
                            : (sub.grade || 0) >= 50
                            ? "text-warning"
                            : "text-destructive"
                        }`}
                      >
                        {sub.grade} / 100
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {sub.feedback || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateLocalized(sub.gradedAt, locale)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

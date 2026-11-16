import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { t, formatDateLocalized } from "@/i18n";
import { Prisma } from "@prisma/client";
import AttendanceManager from "@/components/AttendanceManager";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSelectedParentChildIds } from "@/lib/parent-child";

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
    const selectedChildIds = getSelectedParentChildIds(
      childLinks.map((l) => l.studentMembershipId)
    );
    whereCondition = {
      lesson: { module: { course: { centerId } } },
      studentMembershipId: { in: selectedChildIds },
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

  const statusBadges: Record<string, { labelKey: string; variant: BadgeVariant }> = {
    PRESENT: { labelKey: "attendance.present", variant: "success" },
    ABSENT: { labelKey: "attendance.absent", variant: "destructive" },
    EXCUSED: { labelKey: "attendance.excused", variant: "info" },
    LATE: { labelKey: "attendance.late", variant: "warning" },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "attendance.title")}
        description={t(locale, "attendance.attendanceRate")}
      />

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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {t(locale, "reports.attendanceSummary") || "История отметок"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table wrapperClassName="border-0 rounded-none">
            <TableHeader>
              <TableRow>
                <TableHead>{t(locale, "nav.students")}</TableHead>
                <TableHead>{t(locale, "lessons.title")}</TableHead>
                <TableHead>{t(locale, "common.status")}</TableHead>
                <TableHead>{t(locale, "common.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="p-6 text-center text-muted-foreground">
                    {t(locale, "common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                attendances.map((att) => {
                  const badge = statusBadges[att.status] || {
                    labelKey: att.status,
                    variant: "neutral" as BadgeVariant,
                  };
                  return (
                    <TableRow key={att.id}>
                      <TableCell className="font-medium text-foreground">
                        {att.student.user.fullName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {att.lesson.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{t(locale, badge.labelKey)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {formatDateLocalized(att.markedAt, locale)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

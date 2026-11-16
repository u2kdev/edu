import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { t } from "@/i18n";
import { Prisma } from "@prisma/client";
import HomeworkManager, { HomeworkItem } from "@/components/HomeworkManager";
import { PageHeader } from "@/components/ui/page-header";
import { getSelectedParentChildIds } from "@/lib/parent-child";

export default async function CenterHomeworkPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const userRole = session.activeCenterRole || "";
  const currentMembership = session.memberships.find((m) => m.centerId === centerId);

  const isPlatformStaff =
    tenantCtx.isPlatformStaff || session.user.platformRole === "SUPERADMIN";
  const isCenterWide =
    userRole === "DIRECTOR" || userRole === "CENTER_ADMIN" || isPlatformStaff;

  let homeworksWhere: Prisma.HomeworkWhereInput = { id: { in: [] } };
  let allowedSubmissionStudentIds: string[] | null = null;

  if (isCenterWide) {
    homeworksWhere = { lesson: { module: { course: { centerId } } } };
  } else if (
    (userRole === "TEACHER" || userRole === "TEACHER_ASSISTANT") &&
    currentMembership
  ) {
    const groups = await tenantCtx.getTenantDb().group.findMany({
      where:
        userRole === "TEACHER_ASSISTANT"
          ? { centerId, assistantMembershipId: currentMembership.id }
          : { centerId, teacherMembershipId: currentMembership.id },
      select: { courseId: true },
    });
    const courseIds = [...new Set(groups.map((g) => g.courseId))];
    homeworksWhere = {
      lesson: { module: { course: { centerId, id: { in: courseIds } } } },
    };
  } else if (userRole === "STUDENT" && currentMembership) {
    allowedSubmissionStudentIds = [currentMembership.id];
    const enrollments = await tenantCtx.getTenantDb().enrollment.findMany({
      where: { studentMembershipId: currentMembership.id, status: "ACTIVE" },
      select: { group: { select: { courseId: true } } },
    });
    const courseIds = [...new Set(enrollments.map((e) => e.group.courseId))];
    homeworksWhere = {
      lesson: { module: { course: { centerId, id: { in: courseIds } } } },
    };
  } else if (userRole === "PARENT" && currentMembership) {
    const childLinks = await tenantCtx.getTenantDb().parentLink.findMany({
      where: { parentMembershipId: currentMembership.id, status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    const childIds = getSelectedParentChildIds(
      childLinks.map((l) => l.studentMembershipId)
    );
    allowedSubmissionStudentIds = childIds;
    const enrollments =
      childIds.length > 0
        ? await tenantCtx.getTenantDb().enrollment.findMany({
            where: { studentMembershipId: { in: childIds }, status: "ACTIVE" },
            select: { group: { select: { courseId: true } } },
          })
        : [];
    const courseIds = [...new Set(enrollments.map((e) => e.group.courseId))];
    homeworksWhere = {
      lesson: { module: { course: { centerId, id: { in: courseIds } } } },
    };
  }

  const rawHomeworks = await tenantCtx.getTenantDb().homework.findMany({
    where: homeworksWhere,
    include: {
      lesson: { select: { title: true } },
      materials: {
        include: {
          material: { select: { id: true, title: true, materialType: true } },
        },
      },
      submissions:
        allowedSubmissionStudentIds !== null
          ? {
              where: {
                studentMembershipId: { in: allowedSubmissionStudentIds },
              },
              include: {
                student: { include: { user: { select: { fullName: true, email: true } } } },
              },
            }
          : {
              include: {
                student: { include: { user: { select: { fullName: true, email: true } } } },
              },
            },
    },
    orderBy: { createdAt: "desc" },
  });

  const homeworks: HomeworkItem[] = rawHomeworks.map((hw) => ({
    id: hw.id,
    lessonId: hw.lessonId,
    lessonTitle: hw.lesson.title,
    title: hw.title,
    description: hw.description,
    dueDate: hw.dueDate ? hw.dueDate.toISOString() : null,
    materials: hw.materials.map((m) => ({
      id: m.material.id,
      title: m.material.title,
      materialType: m.material.materialType,
    })),
    submissions: hw.submissions.map((s) => ({
      id: s.id,
      studentMembershipId: s.studentMembershipId,
      studentName: s.student.user.fullName || s.student.user.email,
      studentEmail: s.student.user.email,
      submissionText: s.submissionText,
      filesJson: s.filesJson,
      status: s.status,
      grade: s.grade,
      feedback: s.feedback,
      submittedAt: s.submittedAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "homework.title")}
        description={t(locale, "homework.createHomework")}
      />

      <HomeworkManager
        homeworks={homeworks}
        userRole={userRole}
        userMembershipId={currentMembership?.id}
        locale={locale}
      />
    </div>
  );
}

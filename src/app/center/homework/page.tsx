import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { t } from "@/i18n";
import { Prisma } from "@prisma/client";
import HomeworkManager, { HomeworkItem } from "@/components/HomeworkManager";

export default async function CenterHomeworkPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const userRole = session.activeCenterRole || "";
  const currentMembership = session.memberships.find((m) => m.centerId === centerId);

  // Platform staff (DEVELOPER / SUPERADMIN / PLATFORM_SUPPORT) may browse any center.
  const isPlatformStaff =
    tenantCtx.isPlatformStaff || session.user.platformRole === "SUPERADMIN";
  // The center-wide scope is reserved for management and platform staff.
  const isCenterWide =
    userRole === "DIRECTOR" || userRole === "CENTER_ADMIN" || isPlatformStaff;

  // SECURITY: scope homework by role. Default is an empty scope — roles that do
  // not match an explicit branch (or lack a membership in the active center)
  // see nothing instead of the whole center's assignments.
  let homeworksWhere: Prisma.HomeworkWhereInput = { id: { in: [] } };

  if (isCenterWide) {
    homeworksWhere = { lesson: { module: { course: { centerId } } } };
  } else if (
    (userRole === "TEACHER" || userRole === "TEACHER_ASSISTANT") &&
    currentMembership
  ) {
    // Homework belongs to a course; a teacher sees courses of their own groups.
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
    const enrollments = await tenantCtx.getTenantDb().enrollment.findMany({
      where: { studentMembershipId: currentMembership.id },
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
    const childIds = childLinks.map((l) => l.studentMembershipId);
    const enrollments = await tenantCtx.getTenantDb().enrollment.findMany({
      where: { studentMembershipId: { in: childIds } },
      select: { group: { select: { courseId: true } } },
    });
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
      submissions: {
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
      <div>
        <h2 className="text-xl font-bold text-white">{t(locale, "homework.title")}</h2>
        <p className="text-sm text-slate-400 mt-0.5">{t(locale, "homework.createHomework")}</p>
      </div>

      <HomeworkManager
        homeworks={homeworks}
        userRole={userRole}
        userMembershipId={currentMembership?.id}
        locale={locale}
      />
    </div>
  );
}

import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { t } from "@/i18n";
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

  const rawHomeworks = await tenantCtx.getTenantDb().homework.findMany({
    where: {
      lesson: { module: { course: { centerId } } },
    },
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

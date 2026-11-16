import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getActorAcademicScope } from "@/lib/tenant-access";
import type { Prisma } from "@prisma/client";
import CourseManager from "@/components/CourseManager";

export default async function CenterCoursesPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const academicScope = await getActorAcademicScope(tenantCtx);
  const whereCondition: Prisma.CourseWhereInput = academicScope.isUnrestricted
    ? { centerId }
    : { centerId, deletedAt: null, id: { in: academicScope.courseIds } };

  const courses = await tenantCtx.getTenantDb().course.findMany({
    where: whereCondition,
    include: {
      modules: {
        include: { lessons: true },
        orderBy: { orderIndex: "asc" },
      },
      groups: {
        include: {
          teacher: { include: { user: { select: { fullName: true, email: true } } } },
          enrollments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const locale = session.user.preferredLanguage || "ru";

  return (
    <CourseManager
      initialCourses={courses}
      role={session.activeCenterRole || ""}
      locale={locale}
    />
  );
}

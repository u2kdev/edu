import { requireTenantAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import CourseManager from "@/components/CourseManager";

export default async function CenterCoursesPage() {
  const tenantCtx = await requireTenantAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const courses = await tenantCtx.getTenantDb().course.findMany({
    where: { centerId },
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

  return (
    <CourseManager
      initialCourses={courses}
      role={session.activeCenterRole || ""}
    />
  );
}

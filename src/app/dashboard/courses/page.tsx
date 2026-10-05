import { requireTenantAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { getTenantDb } from "@/lib/db-tenant";
import { redirect } from "next/navigation";
import CourseManager from "@/components/CourseManager";

export default async function CoursesPage() {
  const tenantCtx = await requireTenantAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const activeCenterId = session.activeCenterId;
  const activeRole = session.activeCenterRole;

  if (!activeCenterId) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
        <p className="text-slate-400">Выберите или создайте учебный центр для управления курсами.</p>
      </div>
    );
  }

  const courses = await getTenantDb(tenantCtx.center.id).course.findMany({
    where: { centerId: activeCenterId },
    include: {
      modules: {
        include: { lessons: true },
        orderBy: { orderIndex: "asc" },
      },
      groups: {
        include: {
          teacher: { include: { user: { select: { fullName: true } } } },
          enrollments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Курсы и Уроки</h1>
          <p className="text-sm text-slate-400 mt-1">Управление учебными программами, модулями и занятиями</p>
        </div>
      </div>

      <CourseManager initialCourses={courses} role={activeRole} />
    </div>
  );
}

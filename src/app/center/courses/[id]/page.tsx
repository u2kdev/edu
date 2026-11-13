import { notFound, redirect } from "next/navigation";
import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";
import CourseBuilder, { type CourseData } from "@/components/courses/CourseBuilder";

export default async function CenterCoursePage({
  params,
}: {
  params: { id: string };
}) {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const tenantDb = tenantCtx.getTenantDb();

  const course = await tenantDb.course.findFirst({
    where: {
      id: params.id,
      centerId,
    },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              materials: {
                where: { deletedAt: null },
                select: { id: true, title: true, materialType: true, fileUrl: true },
              },
            },
          },
        },
      },
      groups: {
        select: { id: true, name: true },
      },
    },
  });

  if (!course) {
    notFound();
  }

  const role = session.activeCenterRole as CenterRole;
  const canManage =
    tenantCtx.isPlatformStaff ||
    hasPermission("courses.manage", session.user.platformRole, role) ||
    role === "DIRECTOR" ||
    role === "CENTER_ADMIN";

  const formattedCourse: CourseData = {
    id: course.id,
    title: course.title,
    description: course.description,
    coverImage: course.coverImage,
    priceMonthly: course.priceMonthly,
    isPublished: course.isPublished,
    deletedAt: course.deletedAt ? course.deletedAt.toISOString() : null,
    modules: course.modules.map((m) => ({
      id: m.id,
      courseId: m.courseId,
      title: m.title,
      orderIndex: m.orderIndex,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        moduleId: l.moduleId,
        title: l.title,
        lessonType: l.lessonType,
        status: l.status,
        orderIndex: l.orderIndex,
        durationMinutes: l.durationMinutes,
        content: l.content,
        videoUrl: l.videoUrl,
        materials: l.materials.map((mat) => ({
          id: mat.id,
          title: mat.title,
          materialType: mat.materialType,
          fileUrl: mat.fileUrl,
        })),
      })),
    })),
    groups: course.groups,
  };

  return (
    <CourseBuilder
      initialCourse={formattedCourse}
      canManage={canManage}
      locale={session.user.preferredLanguage || "ru"}
    />
  );
}

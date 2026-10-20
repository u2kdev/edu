import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

// POST /api/lessons/reorder - Update orderIndex for multiple lessons in batch
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { items } = await req.json(); // Array of { id: string, orderIndex: number }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid payload: items array required" }, { status: 400 });
    }

    // Teachers may only reorder lessons that belong to courses they teach.
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      const lessonIds = items.map((item: { id: string }) => item.id).filter(Boolean);

      const lessons = await tenantDb.lesson.findMany({
        where: { id: { in: lessonIds } },
        select: { module: { select: { courseId: true } } },
      });

      const courseIds = Array.from(new Set(lessons.map((l) => l.module.courseId)));

      const allowedGroups = courseIds.length
        ? await tenantDb.group.findMany({
            where: {
              courseId: { in: courseIds },
              OR: [
                { teacherMembershipId: tenantCtx.membership.id },
                { assistantMembershipId: tenantCtx.membership.id },
              ],
            },
            select: { courseId: true },
          })
        : [];

      const allowedCourseIds = new Set(allowedGroups.map((g) => g.courseId));
      if (courseIds.some((courseId) => !allowedCourseIds.has(courseId))) {
        return NextResponse.json(
          { error: "Forbidden: Teachers can only reorder lessons in their own courses" },
          { status: 403 }
        );
      }
    }

    // tenantDb.$transaction isn't fully mocked for array of updateMany yet in some proxy setups, but we'll try sequential updateMany
    for (const item of items) {
       await tenantDb.lesson.updateMany({
         where: { id: item.id },
         data: { orderIndex: item.orderIndex },
       });
    }

    return NextResponse.json({ success: true, updatedCount: items.length });
  } catch (err: unknown) {
    const errorObj = err as { message?: string; status?: number };
    return NextResponse.json({ error: errorObj.status ? errorObj.message : "Server error" }, { status: errorObj.status || 500 });
  }
}

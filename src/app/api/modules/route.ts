import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { courseId, title } = await req.json();
    if (!courseId || !title) {
      return NextResponse.json({ error: "Course ID and title are required" }, { status: 400 });
    }

    // The course must belong to the active center (tenantDb already scopes by centerId).
    const course = await tenantDb.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Teachers may only add modules to courses they teach.
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      const teacherGroup = await tenantDb.group.findFirst({
        where: {
          courseId,
          OR: [
            { teacherMembershipId: tenantCtx.membership.id },
            { assistantMembershipId: tenantCtx.membership.id },
          ],
        },
      });
      if (!teacherGroup) {
        return NextResponse.json(
          { error: "Forbidden: Teachers can only add modules to their own courses" },
          { status: 403 }
        );
      }
    }

    const maxModule = await tenantDb.courseModule.findFirst({
      where: { courseId },
      orderBy: { orderIndex: "desc" },
    });
    const nextOrder = (maxModule?.orderIndex ?? 0) + 1;

    const moduleRecord = await tenantDb.courseModule.create({
      data: { centerId: tenantCtx.center.id, courseId, title, orderIndex: nextOrder },
    });

    return NextResponse.json({ success: true, module: moduleRecord });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json({ error: error.status ? error.message : "Server error" }, { status: error.status || 500 });
  }
}

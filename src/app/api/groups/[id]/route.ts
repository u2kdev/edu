import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    const group = await tenantDb.group.findFirst({
      where: {
        id: params.id,
        centerId: tenantCtx.center.id,
      },
      include: {
        course: { select: { id: true, title: true } },
        teacher: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
        enrollments: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
              },
            },
          },
          orderBy: { enrolledAt: "asc" },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    // Role check: Teacher can only view their own group
    if (tenantCtx.role === "TEACHER" && group.teacherMembershipId !== tenantCtx.membership?.id && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ group });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Ошибка загрузки группы" },
      { status: error.status || 400 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const group = await tenantDb.group.findFirst({
      where: { id: params.id, centerId: tenantCtx.center.id },
    });

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    const body = await req.json();
    const { name, courseId, teacherMembershipId, maxStudents, startDate, endDate } = body;

    if (courseId) {
      const course = await tenantDb.course.findFirst({
        where: { id: courseId, centerId: tenantCtx.center.id },
      });
      if (!course) {
        return NextResponse.json({ error: "Курс не найден" }, { status: 404 });
      }
    }

    if (teacherMembershipId) {
      const teacher = await tenantDb.centerMembership.findFirst({
        where: {
          id: teacherMembershipId,
          centerId: tenantCtx.center.id,
          role: "TEACHER",
        },
      });
      if (!teacher) {
        return NextResponse.json({ error: "Преподаватель не найден" }, { status: 404 });
      }
    }

    const updated = await tenantDb.group.update({
      where: { id: group.id },
      data: {
        ...(name ? { name } : {}),
        ...(courseId ? { courseId } : {}),
        teacherMembershipId: teacherMembershipId !== undefined ? teacherMembershipId || null : undefined,
        maxStudents: maxStudents !== undefined ? parseInt(maxStudents) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      include: {
        course: { select: { title: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
      },
    });

    return NextResponse.json({ success: true, group: updated });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Ошибка обновления группы" },
      { status: error.status || 400 }
    );
  }
}

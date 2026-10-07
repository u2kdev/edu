import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    let whereCondition: any = {};

    // If teacher, only return groups assigned to this teacher
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      whereCondition.teacherMembershipId = tenantCtx.membership.id;
    }

    const groups = await tenantDb.group.findMany({
      where: whereCondition,
      include: {
        course: { select: { id: true, title: true } },
        teacher: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        enrollments: {
          include: {
            student: {
              include: { user: { select: { fullName: true, email: true, phone: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ groups });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка загрузки групп" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав для создания групп" }, { status: 403 });
    }

    const { courseId, name, teacherMembershipId, maxStudents, startDate } = await req.json();

    if (!courseId || !name) {
      return NextResponse.json({ error: "Выберите курс и укажите название группы" }, { status: 400 });
    }

    const course = await tenantDb.course.findFirst({
      where: { id: courseId },
    });
    if (!course) {
      return NextResponse.json({ error: "Курс не найден или нет доступа" }, { status: 404 });
    }

    if (teacherMembershipId) {
      const teacherMem = await tenantDb.centerMembership.findFirst({
        where: { id: teacherMembershipId, role: "TEACHER" },
      });
      if (!teacherMem) {
        return NextResponse.json({ error: "Преподаватель не найден в этом центре" }, { status: 404 });
      }
    }

    const group = await tenantDb.group.create({
      data: {
        centerId: tenantCtx.center.id,
        courseId,
        name,
        teacherMembershipId: teacherMembershipId || null,
        maxStudents: maxStudents ? parseInt(maxStudents) : 30,
        startDate: startDate ? new Date(startDate) : null,
      },
      include: {
        course: { select: { title: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
      },
    });

    return NextResponse.json({ success: true, group });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка создания группы" }, { status: 400 });
  }
}

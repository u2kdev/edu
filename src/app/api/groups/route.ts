import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();

    let whereCondition: any = { course: { centerId: tenantCtx.center.id } };

    // If teacher, only return groups assigned to this teacher
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      whereCondition.teacherMembershipId = tenantCtx.membership.id;
    }

    const groups = await db.group.findMany({
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

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав для создания групп" }, { status: 403 });
    }

    const { courseId, name, teacherMembershipId, maxStudents, startDate } = await req.json();

    if (!courseId || !name) {
      return NextResponse.json({ error: "Выберите курс и укажите название группы" }, { status: 400 });
    }

    // SECURITY: Validate courseId belongs to this tenant (prevents cross-tenant group injection)
    const course = await db.course.findFirst({
      where: { id: courseId, centerId: tenantCtx.center.id },
    });
    if (!course) {
      return NextResponse.json({ error: "Курс не найден или нет доступа" }, { status: 404 });
    }

    // SECURITY: Validate teacherMembershipId belongs to this tenant
    if (teacherMembershipId) {
      const teacherMem = await db.centerMembership.findFirst({
        where: { id: teacherMembershipId, centerId: tenantCtx.center.id, role: "TEACHER" },
      });
      if (!teacherMem) {
        return NextResponse.json({ error: "Преподаватель не найден в этом центре" }, { status: 404 });
      }
    }

    const group = await db.group.create({
      data: {
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

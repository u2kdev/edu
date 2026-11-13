import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import {
  requireCenterPermission,
  getScopedGroupWhere,
  serializeGroupDTO,
} from "@/lib/tenant-access";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    requireCenterPermission(tenantCtx, "groups.read");
    const tenantDb = tenantCtx.getTenantDb();

    const whereCondition = await getScopedGroupWhere(tenantCtx);

    const rawGroups = await tenantDb.group.findMany({
      where: whereCondition,
      include: {
        course: { select: { id: true, title: true } },
        teacher: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        assistant: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        enrollments: {
          where: { student: { status: "ACTIVE" } },
          include: {
            student: {
              include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const isPrivileged = tenantCtx.isPlatformStaff || Boolean(tenantCtx.session.impersonatorUserId);
    const groups = rawGroups.map((g) => serializeGroupDTO(g, tenantCtx.role, isPrivileged));

    return NextResponse.json({ groups });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Ошибка загрузки групп" },
      { status: error.status || 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    requireCenterPermission(tenantCtx, "groups.manage");
    const tenantDb = tenantCtx.getTenantDb();

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Недостаточно прав для создания групп" }, { status: 403 });
    }

    const { courseId, name, teacherMembershipId, assistantMembershipId, maxStudents, startDate } = await req.json();

    if (!courseId || !name) {
      return NextResponse.json({ error: "Выберите курс и укажите название группы" }, { status: 400 });
    }

    const course = await tenantDb.course.findFirst({
      where: { id: courseId, centerId: tenantCtx.center.id },
    });
    if (!course) {
      return NextResponse.json({ error: "Курс не найден или нет доступа" }, { status: 404 });
    }

    if (teacherMembershipId) {
      const teacherMem = await tenantDb.centerMembership.findFirst({
        where: { id: teacherMembershipId, centerId: tenantCtx.center.id, role: "TEACHER" },
      });
      if (!teacherMem) {
        return NextResponse.json({ error: "Преподаватель не найден в этом центре" }, { status: 404 });
      }
    }

    if (assistantMembershipId) {
      const assistantMem = await tenantDb.centerMembership.findFirst({
        where: { id: assistantMembershipId, centerId: tenantCtx.center.id, role: "TEACHER_ASSISTANT" },
      });
      if (!assistantMem) {
        return NextResponse.json({ error: "Ассистент не найден в этом центре" }, { status: 404 });
      }
    }

    const group = await tenantDb.group.create({
      data: {
        centerId: tenantCtx.center.id,
        courseId,
        name,
        teacherMembershipId: teacherMembershipId || null,
        assistantMembershipId: assistantMembershipId || null,
        maxStudents: maxStudents ? parseInt(maxStudents) : 30,
        startDate: startDate ? new Date(startDate) : null,
      },
      include: {
        course: { select: { title: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
        assistant: { include: { user: { select: { fullName: true } } } },
      },
    });

    return NextResponse.json({ success: true, group });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Ошибка создания группы" },
      { status: error.status || 400 }
    );
  }
}

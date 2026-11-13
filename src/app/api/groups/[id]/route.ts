import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import {
  assertGroupAccess,
  serializeGroupDTO,
  requireCenterPermission,
} from "@/lib/tenant-access";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    requireCenterPermission(tenantCtx, "groups.read");

    // Strictly asserts group ownership/enrollment based on caller role
    await assertGroupAccess(tenantCtx, params.id, "read");

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
        assistant: {
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

    const isPrivileged =
      tenantCtx.isPlatformStaff || Boolean(tenantCtx.session.impersonatorUserId);
    const serializedGroup = serializeGroupDTO(group, tenantCtx.role, isPrivileged);

    return NextResponse.json({ group: serializedGroup });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Ошибка загрузки группы" },
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
    requireCenterPermission(tenantCtx, "groups.manage");

    // Only Director/Admin or platform staff can modify groups
    await assertGroupAccess(tenantCtx, params.id, "write");

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantDb = tenantCtx.getTenantDb();
    const group = await tenantDb.group.findFirst({
      where: { id: params.id, centerId: tenantCtx.center.id },
    });

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    const body = await req.json();
    const { name, courseId, teacherMembershipId, assistantMembershipId, maxStudents, startDate, endDate } = body;

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

    if (assistantMembershipId) {
      const assistant = await tenantDb.centerMembership.findFirst({
        where: {
          id: assistantMembershipId,
          centerId: tenantCtx.center.id,
          role: "TEACHER_ASSISTANT",
        },
      });
      if (!assistant) {
        return NextResponse.json({ error: "Ассистент не найден" }, { status: 404 });
      }
    }

    await tenantDb.group.update({
      where: { id: group.id },
      data: {
        ...(name ? { name } : {}),
        ...(courseId ? { courseId } : {}),
        teacherMembershipId: teacherMembershipId !== undefined ? teacherMembershipId || null : undefined,
        assistantMembershipId: assistantMembershipId !== undefined ? assistantMembershipId || null : undefined,
        maxStudents: maxStudents !== undefined ? parseInt(maxStudents) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    });

    const updated = await tenantDb.group.findFirst({
      where: { id: group.id },
      include: {
        course: { select: { title: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
        assistant: { include: { user: { select: { fullName: true } } } },
      },
    });

    if (assistantMembershipId !== undefined && assistantMembershipId !== group.assistantMembershipId) {
      await logAuditEvent({
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: assistantMembershipId ? "GROUP_ASSISTANT_ASSIGN" : "GROUP_ASSISTANT_REMOVE",
        resource: "Group",
        resourceId: group.id,
        details: {
          previousAssistantId: group.assistantMembershipId,
          newAssistantId: assistantMembershipId,
        },
      });
    }

    return NextResponse.json({ success: true, group: updated });
  } catch (err: unknown) {
    console.error("PUT /api/groups/[id] error:", err);
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Ошибка обновления группы" },
      { status: error.status || 400 }
    );
  }
}

export const PATCH = PUT;

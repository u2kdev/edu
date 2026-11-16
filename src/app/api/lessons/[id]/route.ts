import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";
import { getActorAcademicScope } from "@/lib/tenant-access";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    const lesson = await tenantDb.lesson.findFirst({
      where: { id: params.id, centerId: center.id },
      include: {
        module: {
          select: { id: true, title: true, courseId: true },
        },
        materials: {
          where: { deletedAt: null },
          orderBy: { orderIndex: "asc" },
        },
        homeworks: true,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Урок не найден" }, { status: 404 });
    }

    const scope = await getActorAcademicScope(tenantCtx);
    if (!scope.isUnrestricted) {
      if (!lesson.module?.courseId || !scope.courseIds.includes(lesson.module.courseId)) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to this lesson's course" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ lesson });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("GET /api/lessons/[id] error:", err);
    return NextResponse.json({ error: "Не удалось загрузить урок" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    const lesson = await tenantDb.lesson.findFirst({
      where: { id: params.id, centerId: center.id },
      include: {
        module: {
          select: { courseId: true },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Урок не найден" }, { status: 404 });
    }

    const hasGlobalManage =
      tenantCtx.isPlatformStaff ||
      hasPermission("courses.manage", session.user.platformRole, actorRole as CenterRole);

    if (!hasGlobalManage) {
      if (
        (actorRole === "TEACHER" || actorRole === "TEACHER_ASSISTANT") &&
        tenantCtx.membership?.id &&
        lesson.module?.courseId
      ) {
        const group = await tenantDb.group.findFirst({
          where: {
            centerId: center.id,
            courseId: lesson.module.courseId,
            ...(actorRole === "TEACHER"
              ? { teacherMembershipId: tenantCtx.membership.id }
              : { assistantMembershipId: tenantCtx.membership.id }),
          },
        });
        if (!group) {
          return NextResponse.json(
            { error: "Forbidden: You are not assigned to this course" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Forbidden: No permission to delete lessons" },
          { status: 403 }
        );
      }
    }

    await tenantDb.lesson.delete({
      where: { id: lesson.id },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "LESSON_DELETED",
      resource: "Lesson",
      resourceId: lesson.id,
      details: { title: lesson.title, moduleId: lesson.moduleId },
    });

    return NextResponse.json({ success: true, message: "Урок удален" });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("DELETE /api/lessons/[id] error:", err);
    return NextResponse.json({ error: "Не удалось удалить урок" }, { status: 500 });
  }
}

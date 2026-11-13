import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";

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

    return NextResponse.json({ lesson });
  } catch (err: unknown) {
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

    const canManage =
      tenantCtx.isPlatformStaff ||
      hasPermission("courses.manage", session.user.platformRole, actorRole as CenterRole) ||
      actorRole === "TEACHER";

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden: No permission to delete lessons" }, { status: 403 });
    }

    const lesson = await tenantDb.lesson.findFirst({
      where: { id: params.id, centerId: center.id },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Урок не найден" }, { status: 404 });
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
    console.error("DELETE /api/lessons/[id] error:", err);
    return NextResponse.json({ error: "Не удалось удалить урок" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";

const updateModuleSchema = z.object({
  title: z.string().min(1, "Название модуля не может быть пустым").max(120).optional(),
  orderIndex: z.number().int().optional(),
});

export async function PATCH(
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
      return NextResponse.json({ error: "Forbidden: No permission" }, { status: 403 });
    }

    const moduleRecord = await tenantDb.courseModule.findFirst({
      where: { id: params.id, centerId: center.id },
    });

    if (!moduleRecord) {
      return NextResponse.json({ error: "Модуль не найден" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateModuleSchema.parse(body);

    const updated = await tenantDb.courseModule.update({
      where: { id: moduleRecord.id },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title.trim() } : {}),
        ...(parsed.orderIndex !== undefined ? { orderIndex: parsed.orderIndex } : {}),
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "MODULE_UPDATED",
      resource: "CourseModule",
      resourceId: moduleRecord.id,
      details: { title: updated.title, orderIndex: updated.orderIndex },
    });

    return NextResponse.json({ success: true, module: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    console.error("PATCH /api/modules/[id] error:", err);
    return NextResponse.json({ error: "Не удалось обновить модуль" }, { status: 500 });
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
      hasPermission("courses.manage", session.user.platformRole, actorRole as CenterRole);

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden: No permission to delete modules" }, { status: 403 });
    }

    const moduleRecord = await tenantDb.courseModule.findFirst({
      where: { id: params.id, centerId: center.id },
    });

    if (!moduleRecord) {
      return NextResponse.json({ error: "Модуль не найден" }, { status: 404 });
    }

    await tenantDb.courseModule.delete({
      where: { id: moduleRecord.id },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "MODULE_DELETED",
      resource: "CourseModule",
      resourceId: moduleRecord.id,
      details: { title: moduleRecord.title, courseId: moduleRecord.courseId },
    });

    return NextResponse.json({ success: true, message: "Модуль удален" });
  } catch (err: unknown) {
    console.error("DELETE /api/modules/[id] error:", err);
    return NextResponse.json({ error: "Не удалось удалить модуль" }, { status: 500 });
  }
}

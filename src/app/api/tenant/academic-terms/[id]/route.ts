import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";

const updateTermSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
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
      hasPermission("settings.manage", session.user.platformRole, actorRole as CenterRole) ||
      actorRole === "DIRECTOR" ||
      actorRole === "CENTER_ADMIN";

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const term = await tenantDb.academicTerm.findFirst({
      where: { id: params.id, centerId: center.id },
    });

    if (!term) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateTermSchema.parse(body);

    const newStart = parsed.startDate ? new Date(parsed.startDate) : term.startDate;
    const newEnd = parsed.endDate ? new Date(parsed.endDate) : term.endDate;

    if (newEnd < newStart) {
      return NextResponse.json({ error: "Дата окончания не может быть раньше даты начала" }, { status: 400 });
    }

    const updated = await tenantDb.academicTerm.update({
      where: { id: term.id },
      data: {
        ...(parsed.name ? { name: parsed.name.trim() } : {}),
        startDate: newStart,
        endDate: newEnd,
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "ACADEMIC_TERM_UPDATED",
      resource: "AcademicTerm",
      resourceId: term.id,
      details: { name: updated.name, startDate: updated.startDate, endDate: updated.endDate },
    });

    return NextResponse.json({ success: true, term: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    console.error("PATCH /api/tenant/academic-terms/[id] error:", err);
    return NextResponse.json({ error: "Не удалось обновить период" }, { status: 500 });
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
      hasPermission("settings.manage", session.user.platformRole, actorRole as CenterRole) ||
      actorRole === "DIRECTOR" ||
      actorRole === "CENTER_ADMIN";

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const term = await tenantDb.academicTerm.findFirst({
      where: { id: params.id, centerId: center.id },
    });

    if (!term) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }

    await tenantDb.academicTerm.delete({
      where: { id: term.id },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "ACADEMIC_TERM_DELETED",
      resource: "AcademicTerm",
      resourceId: term.id,
      details: { name: term.name },
    });

    return NextResponse.json({ success: true, message: "Учебный период удален" });
  } catch (err: unknown) {
    console.error("DELETE /api/tenant/academic-terms/[id] error:", err);
    return NextResponse.json({ error: "Не удалось удалить период" }, { status: 500 });
  }
}

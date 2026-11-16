import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";

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

    const holiday = await tenantDb.holiday.findFirst({
      where: { id: params.id, centerId: center.id },
    });

    if (!holiday) {
      return NextResponse.json({ error: "Праздник не найден" }, { status: 404 });
    }

    await tenantDb.holiday.delete({
      where: { id: holiday.id },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "HOLIDAY_DELETED",
      resource: "Holiday",
      resourceId: holiday.id,
      details: { name: holiday.name },
    });

    return NextResponse.json({ success: true, message: "Праздник удален" });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("DELETE /api/tenant/holidays/[id] error:", err);
    return NextResponse.json({ error: "Не удалось удалить праздник" }, { status: 500 });
  }
}

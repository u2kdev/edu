import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json(
        { error: "Forbidden: Only directors and administrators can finalize assessment periods" },
        { status: 403 }
      );
    }

    const { groupId } = await req.json();

    if (!groupId) {
      return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    }

    const group = await tenantDb.group.findFirst({
      where: { id: groupId },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const now = new Date();
    const finalizedById = tenantCtx.membership?.id || null;

    const result = await tenantDb.grade.updateMany({
      where: {
        groupId,
        lifecycle: { in: ["DRAFT", "SUBMITTED"] },
        deletedAt: null,
      },
      data: {
        lifecycle: "FINAL",
        finalizedAt: now,
        finalizedById,
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "PERIOD_FINALIZED",
      resource: "Group",
      resourceId: groupId,
      details: {
        groupName: group.name,
        finalizedCount: result.count,
        finalizedById,
      },
    });

    return NextResponse.json({
      success: true,
      groupId,
      finalizedCount: result.count,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error?.message || "Server error", code: error?.code },
      { status: error?.status || 400 }
    );
  }
}

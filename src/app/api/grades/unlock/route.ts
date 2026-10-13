import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    if (tenantCtx.role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Forbidden: Only the director can unlock finalized grades or assessment periods" },
        { status: 403 }
      );
    }

    const { gradeId, groupId, reason } = await req.json();

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json(
        { error: "A valid reason is required to unlock finalized grades or assessment periods" },
        { status: 400 }
      );
    }

    if (!gradeId && !groupId) {
      return NextResponse.json(
        { error: "Either gradeId or groupId must be provided" },
        { status: 400 }
      );
    }

    if (gradeId) {
      const grade = await tenantDb.grade.findFirst({
        where: { id: gradeId, deletedAt: null },
      });

      if (!grade) {
        return NextResponse.json({ error: "Grade not found" }, { status: 404 });
      }

      if (grade.lifecycle !== "FINAL") {
        return NextResponse.json(
          { error: "Grade is not finalized, no unlock required" },
          { status: 400 }
        );
      }

      await tenantDb.grade.updateMany({
        where: { id: gradeId },
        data: {
          lifecycle: "SUBMITTED",
          finalizedAt: null,
          finalizedById: null,
        },
      });

      await logAuditEvent({
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: "GRADE_UNLOCKED",
        resource: "Grade",
        resourceId: gradeId,
        details: {
          reason: reason.trim(),
          unlockedById: tenantCtx.membership?.id || null,
          previousLifecycle: "FINAL",
        },
      });

      return NextResponse.json({
        success: true,
        unlockedGradeId: gradeId,
        reason: reason.trim(),
      });
    }

    if (groupId) {
      const group = await tenantDb.group.findFirst({
        where: { id: groupId },
      });

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      await logAuditEvent({
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: "PERIOD_UNLOCKED",
        resource: "Group",
        resourceId: groupId,
        details: {
          reason: reason.trim(),
          unlockedById: tenantCtx.membership?.id || null,
        },
      });

      return NextResponse.json({
        success: true,
        unlockedGroupId: groupId,
        reason: reason.trim(),
      });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: error?.status || 500 }
    );
  }
}

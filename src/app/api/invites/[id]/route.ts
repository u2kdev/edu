import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// PATCH /api/invites/[id] - Revoke an invite code
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invite = await db.inviteCode.findUnique({
      where: { id: params.id },
    });

    if (!invite || invite.centerId !== tenantCtx.center.id) {
      return NextResponse.json({ error: "Invite code not found" }, { status: 404 });
    }

    const updated = await db.inviteCode.update({
      where: { id: params.id },
      data: { isRevoked: true },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "INVITE_REVOKED",
      resource: "InviteCode",
      resourceId: invite.id,
      details: { code: invite.code },
    });

    return NextResponse.json({ success: true, invite: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

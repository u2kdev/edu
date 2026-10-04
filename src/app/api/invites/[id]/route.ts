import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// PATCH /api/invites/[id] - Revoke an invite code
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invite = await tenantDb.inviteCode.findFirst({
      where: { id: params.id },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite code not found" }, { status: 404 });
    }

    await tenantDb.inviteCode.updateMany({
      where: { id: params.id },
      data: { isRevoked: true },
    });
    
    const updated = await tenantDb.inviteCode.findFirst({ where: { id: params.id } });

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

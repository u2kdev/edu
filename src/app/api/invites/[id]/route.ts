import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// PATCH /api/invites/[id] - Revoke an invite code
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

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
  } catch (err: unknown) {
    const errorObj = err as { message?: string; status?: number };
    return NextResponse.json({ error: errorObj.status ? errorObj.message : "Server error" }, { status: errorObj.status || 500 });
  }
}

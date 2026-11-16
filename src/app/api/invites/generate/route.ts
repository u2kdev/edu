import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { canAssignCenterRole } from "@/lib/permissions";
import type { MembershipRole } from "@prisma/client";

import { generateSecureInviteCode } from "@/lib/invites";

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    
    // Only Director and Center Admin (or platform staff) can generate invite codes
    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { targetRole, courseId, groupId, maxUses, customCode } = await req.json();

    const requestedRole: string = targetRole ? String(targetRole) : "STUDENT";
    if (
      !canAssignCenterRole(
        tenantCtx.session.user.platformRole,
        tenantCtx.role,
        requestedRole
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden: Cannot generate invite for this role" },
        { status: 403 }
      );
    }

    const resolvedTargetRole = requestedRole as MembershipRole;

    const code = customCode
      ? customCode.toUpperCase().trim()
      : `${tenantCtx.center.slug.toUpperCase()}-${generateSecureInviteCode(12)}`;

    let createdByMembershipId = tenantCtx.membership?.id;
    if (!createdByMembershipId) {
      const directorMem = await tenantDb.centerMembership.findFirst({
        where: { role: "DIRECTOR" },
      });
      createdByMembershipId = directorMem?.id;
    }
    if (!createdByMembershipId) {
      return NextResponse.json({ error: "Could not resolve creator membership" }, { status: 403 });
    }

    const invite = await tenantDb.inviteCode.create({
      data: {
        centerId: tenantCtx.center.id,
        code,
        targetRole: resolvedTargetRole,
        courseId: courseId || null,
        groupId: groupId || null,
        maxUses: maxUses ? parseInt(maxUses) : 10,
        createdByMembershipId,
      },
      include: {
        course: { select: { title: true } },
        group: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, invite });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    if (error.code === "P2002") {
      return NextResponse.json({ error: "This code is already in use" }, { status: error.status || 400 });
    }
    return NextResponse.json({ error: error.status ? error.message : "Server error" }, { status: error.status || 400 });
  }
}

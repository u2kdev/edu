import { NextResponse } from "next/server";
// Reason: Exception: Tenant password reset links operate on global user and token models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";
import { sendPasswordSetupLink } from "@/lib/password-reset";
import { canActorManageRole } from "@/lib/tenant-user-guard";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const actorUser = session.user;
    const tenantDb = tenantCtx.getTenantDb();

    if (!hasPermission("users.reset_password", session.user.platformRole, actorRole as CenterRole) && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden: No permission to send reset link" }, { status: 403 });
    }

    const membershipId = params.id;
    const membership = await tenantDb.centerMembership.findFirst({
      where: {
        centerId: center.id,
        OR: [
          { id: membershipId },
          { userId: membershipId },
        ],
      },
      include: { user: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Пользователь не найден в центре" }, { status: 404 });
    }

    const roleCheck = canActorManageRole(actorRole, membership.role, tenantCtx.isPlatformStaff);
    if (!roleCheck.allowed) {
      return NextResponse.json({ error: roleCheck.reason || "Forbidden" }, { status: 403 });
    }

    const isSyntheticEmail = membership.user.email.endsWith("@noemail.local");
    const targetEmail = !isSyntheticEmail ? membership.user.email : null;

    const delivery = await sendPasswordSetupLink({
      userId: membership.user.id,
      email: targetEmail || membership.user.email,
      fullName: membership.user.fullName,
      lang: membership.user.preferredLanguage,
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: actorUser.id,
      action: "SEND_PASSWORD_RESET_LINK",
      resource: "PlatformUser",
      resourceId: membership.user.id,
      details: {
        actorRole,
        targetUserId: membership.user.id,
        queued: delivery.queued,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Ссылка для сброса пароля успешно создана",
      resetUrl: process.env.NODE_ENV !== "production" ? delivery.resetUrl : undefined,
    });
  } catch (err: unknown) {
    console.error("POST /api/tenant/users/[id]/send-reset-link error:", err);
    return NextResponse.json({ error: "Failed to send reset link" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Password reset updates global user credentials.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";
import { generateSecurePassword } from "@/lib/generatePassword";
import { canManageUserAccount, canActorManageRole } from "@/lib/tenant-user-guard";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6).optional(),
});

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
      return NextResponse.json({ error: "Forbidden: No permission to reset passwords" }, { status: 403 });
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

    // Role hierarchy check
    const roleCheck = canActorManageRole(actorRole, membership.role, tenantCtx.isPlatformStaff);
    if (!roleCheck.allowed) {
      return NextResponse.json({ error: roleCheck.reason || "Forbidden" }, { status: 403 });
    }

    // Shared accounts check
    const manageability = await canManageUserAccount(center.id, membership.user.id);
    if (!manageability.canManage) {
      return NextResponse.json(
        {
          error:
            manageability.reason ||
            "Пользователь состоит в нескольких центрах, смена доступа возможна только самим пользователем",
          code: "USER_IS_SHARED",
          isShared: true,
          canSendResetLink: true,
        },
        { status: 403 }
      );
    }

    let customPassword: string | undefined;
    try {
      const body = await req.json();
      const parsed = resetPasswordSchema.parse(body || {});
      customPassword = parsed.newPassword;
    } catch {
      // Empty body is allowed, will generate random password
    }

    const rawPassword = customPassword && customPassword.trim().length >= 6
      ? customPassword.trim()
      : generateSecurePassword(16);

    const passwordHash = await hashPassword(rawPassword);

    // Update PlatformUser password, force password change on next login
    await db.platformUser.update({
      where: { id: membership.user.id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    // Revoke all active sessions of this user everywhere
    await db.userSession.deleteMany({
      where: { userId: membership.user.id },
    });

    // Log to AuditLog — NEVER RECORD THE PASSWORD
    await logAuditEvent({
      centerId: center.id,
      actorUserId: actorUser.id,
      action: "RESET_PASSWORD",
      resource: "PlatformUser",
      resourceId: membership.user.id,
      details: {
        actorRole,
        targetUserId: membership.user.id,
        targetRole: membership.role,
        forcedPasswordChange: true,
        sessionsRevoked: true,
      },
    });

    const isSyntheticEmail = membership.user.email.endsWith("@noemail.local");
    const primaryLogin =
      (!isSyntheticEmail ? membership.user.email : null) ||
      membership.user.phone ||
      membership.user.username ||
      membership.user.fullName;

    const baseUrl = process.env.NEXTAUTH_URL || "https://e-darschi.uz";
    const loginUrl = `${baseUrl}/login`;

    return NextResponse.json(
      {
        success: true,
        credentials: {
          login: primaryLogin,
          password: rawPassword,
          loginUrl,
          fullName: membership.user.fullName,
          mustChangePassword: true,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: unknown) {
    console.error("POST /api/tenant/users/[id]/reset-password error:", err);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, hashPassword } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { generateSecurePassword } from "@/lib/generatePassword";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission("platform.users.reset_password", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id } = params;

    const targetUser = await db.platformUser.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Role restrictions:
    if (targetUser.platformRole === "DEVELOPER" && session.user.platformRole !== "DEVELOPER") {
      return NextResponse.json({ error: "Нельзя сбросить пароль разработчика" }, { status: 403 });
    }

    if (
      targetUser.platformRole === "SUPERADMIN" &&
      targetUser.id !== session.user.id &&
      session.user.platformRole !== "DEVELOPER"
    ) {
      return NextResponse.json({ error: "SUPERADMIN не может сбросить пароль другого SUPERADMIN" }, { status: 403 });
    }

    if (session.user.platformRole === "PLATFORM_ADMIN" && targetUser.platformRole !== "NONE") {
      return NextResponse.json({ error: "PLATFORM_ADMIN не может сбрасывать пароли сотрудников платформы" }, { status: 403 });
    }

    const newPassword = generateSecurePassword(16);
    const newHash = await hashPassword(newPassword);

    await db.$transaction([
      db.platformUser.update({
        where: { id: targetUser.id },
        data: {
          passwordHash: newHash,
          mustChangePassword: true,
        },
      }),
      // Revoke all existing sessions
      db.userSession.deleteMany({
        where: { userId: targetUser.id },
      }),
    ]);

    await logAuditEvent({
      action: "PLATFORM_USER_PASSWORD_RESET",
      resource: "PlatformUser",
      resourceId: targetUser.id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: {
        targetEmail: targetUser.email,
        mustChangePassword: true,
      },
    });

    return NextResponse.json({
      success: true,
      newPassword,
      message: "Пароль успешно сброшен",
    });
  } catch (error) {
    console.error("[POST /api/platform/users/[id]/reset-password]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

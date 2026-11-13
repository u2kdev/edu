import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission("platform.users.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id } = params;

    const targetUser = await db.platformUser.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (session.user.platformRole === "PLATFORM_ADMIN" && targetUser.platformRole !== "NONE") {
      return NextResponse.json({ error: "PLATFORM_ADMIN не может сбрасывать сессии сотрудников платформы" }, { status: 403 });
    }

    const deletedCount = await db.userSession.deleteMany({
      where: { userId: targetUser.id },
    });

    await logAuditEvent({
      action: "PLATFORM_USER_SESSIONS_REVOKED",
      resource: "PlatformUser",
      resourceId: targetUser.id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: {
        sessionsCount: deletedCount.count,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Завершено ${deletedCount.count} активных сессий`,
      revokedCount: deletedCount.count,
    });
  } catch (error) {
    console.error("[DELETE /api/platform/users/[id]/sessions]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

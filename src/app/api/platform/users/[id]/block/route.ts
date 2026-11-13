import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";

const blockSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().min(5, "Укажите причину (минимум 5 символов)"),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission("platform.users.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const parsed = blockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const targetUser = await db.platformUser.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.id === session.user.id) {
      return NextResponse.json({ error: "Нельзя заблокировать себя" }, { status: 400 });
    }

    if (targetUser.platformRole === "DEVELOPER" && session.user.platformRole !== "DEVELOPER") {
      return NextResponse.json({ error: "Нельзя заблокировать разработчика" }, { status: 403 });
    }

    if (
      targetUser.platformRole === "SUPERADMIN" &&
      session.user.platformRole !== "DEVELOPER"
    ) {
      return NextResponse.json({ error: "SUPERADMIN не может блокировать другого SUPERADMIN" }, { status: 403 });
    }

    if (session.user.platformRole === "PLATFORM_ADMIN" && targetUser.platformRole !== "NONE") {
      return NextResponse.json({ error: "PLATFORM_ADMIN не может блокировать сотрудников платформы" }, { status: 403 });
    }

    const { isActive, reason } = parsed.data;

    await db.$transaction(async (tx) => {
      await tx.platformUser.update({
        where: { id: targetUser.id },
        data: { isActive },
      });

      // If blocked, immediately revoke all active sessions
      if (!isActive) {
        await tx.userSession.deleteMany({
          where: { userId: targetUser.id },
        });
      }
    });

    await logAuditEvent({
      action: isActive ? "PLATFORM_USER_UNBLOCKED" : "PLATFORM_USER_BLOCKED",
      resource: "PlatformUser",
      resourceId: targetUser.id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: {
        reason,
        previousState: targetUser.isActive,
        newState: isActive,
      },
    });

    return NextResponse.json({
      success: true,
      isActive,
      message: isActive ? "Пользователь разблокирован" : "Пользователь заблокирован",
    });
  } catch (error) {
    console.error("[POST /api/platform/users/[id]/block]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePlatformPermission("platform.security", req);
    const { id } = params;

    const targetSession = await db.userSession.findUnique({
      where: { id },
      include: { user: { select: { email: true, fullName: true } } },
    });

    if (!targetSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await db.userSession.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "PLATFORM_SESSION_FORCE_REVOKED",
        resource: "UserSession",
        resourceId: id,
        detailsJson: JSON.stringify({
          targetUserId: targetSession.userId,
          targetUserEmail: targetSession.user.email,
          ipAddress: targetSession.ipAddress,
        }),
      },
    });

    return NextResponse.json({ success: true, revokedId: id });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}

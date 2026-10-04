import { NextResponse } from "next/server";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await db.userSession.findMany({
      where: { userId: session.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
      }
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        ...s,
        isCurrent: s.id === session.sessionId
      }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const allButCurrent = searchParams.get("allButCurrent") === "true";

    if (allButCurrent && session.sessionId) {
      await db.userSession.updateMany({
        where: {
          userId: session.user.id,
          id: { not: session.sessionId },
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
      return NextResponse.json({ success: true });
    }

    if (id) {
      // Ensure we only revoke our own session
      const userSession = await db.userSession.findFirst({
        where: { id, userId: session.user.id }
      });

      if (!userSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      await db.userSession.update({
        where: { id },
        data: { revokedAt: new Date() }
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, signJWT } from "@/lib/auth";
import { logAuditEvent } from "@/lib/tenant";

// POST /api/platform/impersonate - Platform support / Superadmin impersonates a user with mandatory audit log
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles = ["SUPERADMIN", "DEVELOPER", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT"];
    if (!allowedRoles.includes(session.user.platformRole)) {
      return NextResponse.json(
        { error: "Forbidden: Only platform owners/developers can impersonate users" },
        { status: 403 }
      );
    }

    const { targetUserId, targetCenterId, reason } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID required" }, { status: 400 });
    }

    const targetUser = await db.platformUser.findUnique({
      where: { id: targetUserId },
      include: { memberships: { include: { center: true } } },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const activeMem = targetCenterId
      ? targetUser.memberships.find((m) => m.centerId === targetCenterId)
      : targetUser.memberships[0];

    // Log impersonation event in AuditLog
    await logAuditEvent({
      centerId: activeMem?.centerId || undefined,
      actorUserId: session.user.id,
      action: "PLATFORM_IMPERSONATION_STARTED",
      resource: "PlatformUser",
      resourceId: targetUser.id,
      details: {
        impersonatorEmail: session.user.email,
        targetEmail: targetUser.email,
        targetRole: activeMem?.role || "NONE",
        reason: reason || "No reason provided",
      },
    });

    // Create session token as target user
    const token = signJWT({
      userId: targetUser.id,
      email: targetUser.email,
      platformRole: targetUser.platformRole,
      activeCenterId: activeMem?.centerId,
      activeCenterRole: activeMem?.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName,
      },
      activeCenterId: activeMem?.centerId,
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1 * 24 * 60 * 60, // 1 day for impersonation session
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("Impersonation error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, createSessionToken, signJWT } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getClientIp } from "@/lib/ip";
import { logAuditEvent } from "@/lib/tenant";
import { cookies } from "next/headers";

import { IMPERSONATION_MAX_AGE_SECONDS, ORIGINAL_SESSION_COOKIE } from "@/lib/impersonation";

// POST /api/platform/impersonate - Platform support / Superadmin impersonates a user with mandatory audit log
export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission("platform.impersonation", session.user.platformRole)) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to impersonate users" },
        { status: 403 }
      );
    }

    let currentOriginalCookie: string | undefined;
    let currentAuthToken: string | undefined;
    try {
      const cookieStore = cookies();
      currentOriginalCookie = cookieStore.get(ORIGINAL_SESSION_COOKIE)?.value;
      currentAuthToken = cookieStore.get("auth_token")?.value;
    } catch {
      // Outside Next.js request scope
    }

    if (req) {
      const cookieHeader = req.headers.get("cookie") || "";
      if (!currentOriginalCookie) {
        const matchOrig = cookieHeader.match(new RegExp(`${ORIGINAL_SESSION_COOKIE}=([^;]+)`));
        if (matchOrig) currentOriginalCookie = decodeURIComponent(matchOrig[1].trim());
      }
      if (!currentAuthToken) {
        const matchAuth = cookieHeader.match(/auth_token=([^;]+)/);
        if (matchAuth) currentAuthToken = decodeURIComponent(matchAuth[1].trim());
      }
      if (!currentAuthToken) {
        currentAuthToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      }
    }

    const { targetUserId, targetCenterId, reason, allowWrite } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID required" }, { status: 400 });
    }

    if (targetUserId === session.user.id) {
      return NextResponse.json({ error: "Forbidden: Cannot impersonate yourself" }, { status: 403 });
    }

    const targetUser = await db.platformUser.findUnique({
      where: { id: targetUserId },
      include: { memberships: { include: { center: true } } },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    // Nobody may impersonate platform-level roles (SUPERADMIN, DEVELOPER, PLATFORM_ADMIN, PLATFORM_SUPPORT, etc.)
    if (targetUser.platformRole && targetUser.platformRole !== "NONE") {
      return NextResponse.json(
        { error: "Forbidden: Cannot impersonate platform staff users" },
        { status: 403 }
      );
    }

    const activeMem = targetCenterId
      ? targetUser.memberships.find((m) => m.centerId === targetCenterId)
      : targetUser.memberships[0];

    const actorRole = session.user.platformRole;

    // PLATFORM_SUPPORT can only impersonate CENTER_SUPPORT in read-only mode
    if (actorRole === "PLATFORM_SUPPORT") {
      if (allowWrite === true) {
        return NextResponse.json(
          { error: "Forbidden: Platform support can only impersonate in read-only mode" },
          { status: 403 }
        );
      }
      if (!activeMem || activeMem.role !== "CENTER_SUPPORT") {
        return NextResponse.json(
          { error: "Forbidden: Platform support may only impersonate CENTER_SUPPORT role" },
          { status: 403 }
        );
      }
    }

    // Write mode is restricted to SUPERADMIN / DEVELOPER and requires a non-empty reason
    const wantsWrite = allowWrite === true;
    if (wantsWrite) {
      if (actorRole !== "SUPERADMIN" && actorRole !== "DEVELOPER") {
        return NextResponse.json(
          { error: "Forbidden: Write impersonation is restricted to SUPERADMIN" },
          { status: 403 }
        );
      }
      if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
        return NextResponse.json(
          { error: "Reason is mandatory for write impersonation" },
          { status: 400 }
        );
      }
    }

    const isReadOnly = !wantsWrite;
    const cleanReason = typeof reason === "string" && reason.trim() ? reason.trim() : "Read-only support session";

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
        reason: cleanReason,
        isReadOnly,
        allowWrite: wantsWrite,
        durationMinutes: 60,
      },
    });

    // Start an impersonation session for the target user (bounded to 60 minutes)
    const token = await createSessionToken(
      {
        userId: targetUser.id,
        email: targetUser.email,
        platformRole: "NONE",
        activeCenterId: activeMem?.centerId,
        activeCenterRole: activeMem?.role,
        impersonatorUserId: session.user.id,
        impersonatedBy: session.user.id,
        impersonationReason: cleanReason,
        isReadOnly,
        allowWrite: wantsWrite,
      },
      {
        maxAgeSeconds: IMPERSONATION_MAX_AGE_SECONDS,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      }
    );

    // Keep or save the original superadmin session token in a separate httpOnly cookie
    // If not already in an impersonation session, save current token.
    const originalTokenToPreserve = currentOriginalCookie || currentAuthToken;
    const originalWrapper = signJWT(
      {
        userId: session.user.id,
        email: session.user.email,
        platformRole: session.user.platformRole,
        originalToken: originalTokenToPreserve || "",
        impersonatedUserId: targetUser.id,
        startedAt: Date.now(),
      },
      "60m"
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName,
      },
      activeCenterId: activeMem?.centerId,
      maxAgeSeconds: IMPERSONATION_MAX_AGE_SECONDS,
    });

    // Set target user's auth_token cookie
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
      path: "/",
    });

    // Set original superadmin session cookie
    response.cookies.set(ORIGINAL_SESSION_COOKIE, originalWrapper, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch (err: unknown) {
    console.error("Impersonation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

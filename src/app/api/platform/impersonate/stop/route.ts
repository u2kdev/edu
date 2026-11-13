import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { verifyJWT, createSessionToken } from "@/lib/auth";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";
import { cookies } from "next/headers";
import { ORIGINAL_SESSION_COOKIE } from "@/lib/impersonation";

export async function POST(req: Request) {
  try {
    let originalWrapperToken: string | undefined;
    try {
      originalWrapperToken = cookies().get(ORIGINAL_SESSION_COOKIE)?.value;
    } catch {
      // Outside Next.js request scope (e.g. unit tests)
    }

    if (!originalWrapperToken && req) {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(new RegExp(`${ORIGINAL_SESSION_COOKIE}=([^;]+)`));
      if (match) originalWrapperToken = decodeURIComponent(match[1].trim());
    }

    if (!originalWrapperToken) {
      return NextResponse.json(
        { error: "No active impersonation session found to stop" },
        { status: 400 }
      );
    }

    const payload = verifyJWT(originalWrapperToken) as {
      userId: string;
      email: string;
      platformRole: string;
      originalToken?: string;
      impersonatedUserId?: string;
      startedAt?: number;
    } | null;

    if (!payload || !payload.userId) {
      return NextResponse.json(
        { error: "Impersonation session expired or invalid" },
        { status: 401 }
      );
    }

    // Verify original user exists and is active
    const originalUser = await db.platformUser.findUnique({
      where: { id: payload.userId },
    });

    if (!originalUser || !originalUser.isActive) {
      return NextResponse.json({ error: "Original account not found or inactive" }, { status: 403 });
    }

    // Create a fresh clean session token for the original superadmin/developer
    const restoredToken = await createSessionToken(
      {
        userId: originalUser.id,
        email: originalUser.email,
        platformRole: originalUser.platformRole,
      },
      {
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days standard
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      }
    );

    // Log the stop event in AuditLog
    await logAuditEvent({
      actorUserId: originalUser.id,
      action: "PLATFORM_IMPERSONATION_STOPPED",
      resource: "PlatformUser",
      resourceId: payload.impersonatedUserId || undefined,
      details: {
        actorEmail: originalUser.email,
        impersonatedUserId: payload.impersonatedUserId,
        durationSeconds: payload.startedAt
          ? Math.round((Date.now() - payload.startedAt) / 1000)
          : null,
      },
    });

    const response = NextResponse.json({
      success: true,
      redirectUrl: "/platform-admin",
    });

    // Restore original user's auth_token cookie
    response.cookies.set("auth_token", restoredToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    // Clear the impersonation tracking cookie
    response.cookies.delete(ORIGINAL_SESSION_COOKIE);

    return response;
  } catch (err: unknown) {
    console.error("Stop impersonation error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

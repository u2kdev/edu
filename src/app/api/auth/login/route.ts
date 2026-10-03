import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comparePassword, signJWT } from "@/lib/auth";
import { getClientIp, checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation/auth";
import { apiError, handleApiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    if (!checkRateLimit(ip)) {
      return apiError("Слишком много попыток входа. Попробуйте через 15 минут.", "RATE_LIMITED", 429);
    }

    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const user = await db.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
        },
      },
    });

    if (!user || !user.isActive) {
      try {
        await db.auditLog.create({
          data: {
            actorUserId: user?.id || "unknown",
            action: "LOGIN_FAILED",
            resource: "PlatformUser",
            detailsJson: JSON.stringify({ email: email.toLowerCase().trim(), reason: "user_not_found_or_inactive", ip }),
            ipAddress: ip,
          },
        });
      } catch { /* ignore audit log failure for login */ }
      return apiError("Неверный email или пароль", "UNAUTHORIZED", 401);
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      try {
        await db.auditLog.create({
          data: {
            actorUserId: user.id,
            action: "LOGIN_FAILED",
            resource: "PlatformUser",
            resourceId: user.id,
            detailsJson: JSON.stringify({ reason: "wrong_password", ip }),
            ipAddress: ip,
          },
        });
      } catch { /* ignore audit log failure */ }
      return apiError("Неверный email или пароль", "UNAUTHORIZED", 401);
    }

    clearRateLimit(ip);

    const activeMembership = user.memberships[0];

    const token = signJWT({
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      activeCenterId: activeMembership?.centerId,
      activeCenterRole: activeMembership?.role,
    });

    try {
      await db.auditLog.create({
        data: {
          centerId: activeMembership?.centerId || null,
          actorUserId: user.id,
          action: "LOGIN_SUCCESS",
          resource: "PlatformUser",
          resourceId: user.id,
          detailsJson: JSON.stringify({
            email: user.email,
            platformRole: user.platformRole,
            activeCenterRole: activeMembership?.role || null,
            ip,
          }),
          ipAddress: ip,
        },
      });
    } catch { /* ignore audit log failure */ }

    const response = apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        platformRole: user.platformRole,
      },
      activeCenterId: activeMembership?.centerId,
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return handleApiError(err);
  }
}


import { z } from "zod";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { comparePassword, signJWT, JWTPayload } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { loginSchema } from "@/lib/validation/auth";
import { v4 as uuidv4 } from "uuid";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (!checkRateLimit(ip)) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    const body = await req.json();
    const parsed = loginSchema.parse(body);
    const { email, password, rememberMe } = parsed;

    const user = await db.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      try {
        await db.auditLog.create({
          data: {
            actorUserId: user?.id || null,
            action: "LOGIN_FAILED",
            resource: "PlatformUser",
            detailsJson: JSON.stringify({ email: email.toLowerCase().trim(), reason: "user_not_found_or_inactive", ip }),
            ipAddress: ip,
          },
        });
      } catch (e) {}
      return apiError("auth.invalidCredentials", "UNAUTHORIZED", 401);
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
            detailsJson: JSON.stringify({ reason: "invalid_password", ip }),
            ipAddress: ip,
          },
        });
      } catch (e) {}
      return apiError("auth.invalidCredentials", "UNAUTHORIZED", 401);
    }

    const jti = uuidv4();
    const expiresIn = rememberMe ? "30d" : "1d";
    const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000);

    const payload: JWTPayload & { jti: string } = {
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      jti,
    } as any;

    const token = signJWT(payload, expiresIn);

    // Create session in DB
    await db.userSession.create({
      data: {
        userId: user.id,
        jti,
        expiresAt,
        ipAddress: ip,
        userAgent,
      }
    });

    try {
      await db.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "LOGIN_SUCCESS",
          resource: "PlatformUser",
          resourceId: user.id,
          ipAddress: ip,
        },
      });
    } catch (e) {}

    cookies().set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
    });

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.platformRole,
      }
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}

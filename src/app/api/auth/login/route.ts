import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comparePassword, signJWT } from "@/lib/auth";

// Simple in-memory rate limiter (per IP, resets on server restart)
// In production: replace with Redis-based rate limiter
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.lastAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true; // allowed
  }
  if (record.count >= MAX_ATTEMPTS) {
    return false; // rate limited
  }
  record.count++;
  record.lastAttempt = now;
  return true; // allowed
}

function clearRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    // Rate limit check
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Слишком много попыток входа. Попробуйте через 15 минут." },
        { status: 429 }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Введите email и пароль" },
        { status: 400 }
      );
    }

    const user = await db.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
        },
      },
    });

    if (!user || !user.isActive) {
      // Log failed attempt (don't reveal whether email exists)
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
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      // Log failed password attempt
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
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    // Successful login — clear rate limit
    clearRateLimit(ip);

    const activeMembership = user.memberships[0];

    const token = signJWT({
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      activeCenterId: activeMembership?.centerId,
      activeCenterRole: activeMembership?.role,
    });

    // Log successful login to audit log
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

    const response = NextResponse.json({
      success: true,
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
    console.error("Login Error:", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

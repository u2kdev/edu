import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-prod";

export type PlatformRole = "NONE" | "DEVELOPER" | "SUPERADMIN" | "PLATFORM_ADMIN" | "FULL_ACCESS" | "PLATFORM_SUPPORT" | "SEO_ADMIN";
export type CenterRole = "DIRECTOR" | "CENTER_ADMIN" | "TEACHER" | "TEACHER_ASSISTANT" | "CENTER_SUPPORT" | "STUDENT" | "PARENT";

export interface JWTPayload {
  userId: string;
  email: string;
  platformRole: PlatformRole | string;
  activeCenterId?: string;
  activeCenterRole?: CenterRole | string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

import crypto from "crypto";

export function signJWT(payload: JWTPayload, expiresIn: string = "7d", jwtId?: string): string {
  const options: jwt.SignOptions = { expiresIn: expiresIn as any };
  if (jwtId) options.jwtid = jwtId;
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyJWT(token: string): (JWTPayload & { jti?: string }) | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload & { jti?: string };
  } catch (err) {
    return null;
  }
}

export function hashJti(jti: string): string {
  return crypto.createHash("sha256").update(jti).digest("hex");
}

export async function getAuthSession(): Promise<{
  user: {
    id: string;
    email: string;
    fullName: string;
    platformRole: PlatformRole | string;
    avatarUrl?: string | null;
    preferredLanguage: string;
    emailVerified: Date | null;
  };
  activeCenterId?: string;
  activeCenterRole?: CenterRole | string;
  memberships: {
    id: string;
    centerId: string;
    centerName: string;
    centerSlug: string;
    centerStatus: string;
    role: CenterRole | string;
  }[];
  jti?: string;
  sessionId?: string;
} | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  const payload = verifyJWT(token);
  if (!payload || !payload.userId) return null;

  let session = null;
  if (payload.jti) {
    // Session check
    const jtiHash = hashJti(payload.jti);
    session = await db.userSession.findUnique({
      where: { jtiHash }
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null; // Session invalid, revoked, or expired
    }

    // Throttle lastSeenAt updates (e.g., max once per 5 minutes)
    const now = new Date();
    const diffMs = now.getTime() - session.lastSeenAt.getTime();
    if (diffMs > 5 * 60 * 1000) {
      // Fire and forget update (no await necessary to block request, but here we await just in case)
      await db.userSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now }
      }).catch(() => {}); // ignore db update errors for lastSeenAt
    }
  } else if (process.env.NODE_ENV !== "test") {
    // Only allow tokens without jti in test environment for backward compatibility of tests
    return null;
  }

  const user = await db.platformUser.findUnique({
    where: { id: payload.userId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: {
          center: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) return null;

  const membershipsFormatted = user.memberships.map((m) => ({
    id: m.id,
    centerId: m.center.id,
    centerName: m.center.name,
    centerSlug: m.center.slug,
    centerStatus: m.center.status,
    role: m.role,
  }));

  // Determine active center: from payload or first available membership
  let activeCenterId = payload.activeCenterId;
  let activeCenterRole = payload.activeCenterRole;

  if (activeCenterId) {
    const activeMem = membershipsFormatted.find((m) => m.centerId === activeCenterId);
    if (activeMem) {
      activeCenterRole = activeMem.role;
    } else {
      activeCenterId = membershipsFormatted[0]?.centerId;
      activeCenterRole = membershipsFormatted[0]?.role;
    }
  } else if (membershipsFormatted.length > 0) {
    activeCenterId = membershipsFormatted[0].centerId;
    activeCenterRole = membershipsFormatted[0].role;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      platformRole: user.platformRole,
      avatarUrl: user.avatarUrl,
      preferredLanguage: user.preferredLanguage || "ru",
      emailVerified: user.emailVerified,
    },
    activeCenterId,
    activeCenterRole,
    memberships: membershipsFormatted,
    jti: payload.jti,
    sessionId: session?.id,
  };
}

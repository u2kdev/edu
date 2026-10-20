import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";
import { languageToLocale } from "./language";

export function validateJwtSecret(secret?: string, isProd: boolean = process.env.NODE_ENV === "production"): string {
  if (!secret) {
    throw new Error(
      isProd
        ? "JWT_SECRET must be defined in production environment and be at least 32 characters long"
        : "JWT_SECRET must be defined in environment variables and be at least 32 characters long"
    );
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
  return secret;
}

let cachedJwtSecret: string | undefined;

/**
 * Resolves the signing secret on first use instead of at module load.
 *
 * `next build` runs with NODE_ENV=production while collecting page data for every
 * route, so a module-scope check would force Docker/Vercel builds to carry the
 * runtime secret. Validation still happens before the first sign/verify: a
 * production process without JWT_SECRET fails closed on the first request.
 */
export function getJwtSecret(): string {
  if (cachedJwtSecret === undefined) {
    cachedJwtSecret = validateJwtSecret(process.env.JWT_SECRET, process.env.NODE_ENV === "production");
  }
  return cachedJwtSecret;
}

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

export function signJWT(payload: JWTPayload, expiresIn: jwt.SignOptions["expiresIn"] = "7d", jwtId?: string): string {
  const options: jwt.SignOptions = { expiresIn };
  if (jwtId) options.jwtid = jwtId;
  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyJWT(token: string): (JWTPayload & { jti?: string }) | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload & { jti?: string };
  } catch (err) {
    return null;
  }
}

export function hashJti(jti: string): string {
  return crypto.createHash("sha256").update(jti).digest("hex");
}

/**
 * Creates a JWT bound to a persisted UserSession (with `jti`) and returns the token.
 *
 * Every flow that starts or refreshes a login session MUST use this helper.
 * `getAuthSession` rejects tokens without `jti` outside of the test environment,
 * so signing a plain JWT (without a matching UserSession row) would immediately
 * log the user out and break session revocation.
 */
export async function createSessionToken(
  payload: JWTPayload,
  options: { maxAgeSeconds: number; ipAddress?: string; userAgent?: string }
): Promise<string> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + options.maxAgeSeconds * 1000);

  const token = signJWT(payload, options.maxAgeSeconds, jti);

  await db.userSession.create({
    data: {
      userId: payload.userId,
      jtiHash: hashJti(jti),
      expiresAt,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    },
  });

  return token;
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

  const hasPlatformImpersonation =
    user.platformRole === "DEVELOPER" ||
    user.platformRole === "SUPERADMIN" ||
    user.platformRole === "PLATFORM_SUPPORT";

  if (activeCenterId) {
    const activeMem = membershipsFormatted.find((m) => m.centerId === activeCenterId);
    if (activeMem) {
      activeCenterRole = activeMem.role;
    } else if (hasPlatformImpersonation) {
      // Platform roles with impersonation can target any center
      activeCenterRole = user.platformRole === "PLATFORM_SUPPORT" ? "CENTER_SUPPORT" : "DIRECTOR";
    } else if (membershipsFormatted.length > 0) {
      activeCenterId = membershipsFormatted[0]?.centerId;
      activeCenterRole = membershipsFormatted[0]?.role;
    } else {
      activeCenterRole = undefined;
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
      preferredLanguage: languageToLocale(user.preferredLanguage),
      emailVerified: user.emailVerified,
    },
    activeCenterId,
    activeCenterRole,
    memberships: membershipsFormatted,
    jti: payload.jti,
    sessionId: session?.id,
  };
}

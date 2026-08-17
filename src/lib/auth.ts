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

export function signJWT(payload: JWTPayload, expiresIn: string = "7d"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (err) {
    return null;
  }
}

export async function getAuthSession(): Promise<{
  user: {
    id: string;
    email: string;
    fullName: string;
    platformRole: PlatformRole | string;
    avatarUrl?: string | null;
    preferredLanguage: string;
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
} | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  const payload = verifyJWT(token);
  if (!payload || !payload.userId) return null;

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
    },
    activeCenterId,
    activeCenterRole,
    memberships: membershipsFormatted,
  };
}

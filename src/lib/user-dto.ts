import type { Prisma } from "@prisma/client";

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  platformRole: true,
  preferredLanguage: true,
  isActive: true,
  mustChangePassword: true,
  twoFactorEnabled: true,
  emailVerified: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedReason: true,
} satisfies Prisma.PlatformUserSelect;

const ALLOWED_USER_KEYS = [
  "id",
  "email",
  "phone",
  "username",
  "fullName",
  "avatarUrl",
  "platformRole",
  "preferredLanguage",
  "isActive",
  "mustChangePassword",
  "twoFactorEnabled",
  "emailVerified",
  "lastLoginAt",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "deletedReason",
  "memberships",
  "ownedCenters",
  "userSessions",
  "auditLogs",
] as const;

export function serializeUser(
  user: unknown
): Record<string, unknown> | null {
  if (!user || typeof user !== "object") {
    return null;
  }

  const u = user as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_USER_KEYS) {
    if (key in u) {
      if (key === "userSessions" && Array.isArray(u.userSessions)) {
        out.userSessions = u.userSessions.map((s: Record<string, unknown>) => ({
          id: s.id,
          ipAddress: s.ipAddress ?? null,
          userAgent: s.userAgent ?? null,
          createdAt: s.createdAt,
          lastSeenAt: s.lastSeenAt,
          expiresAt: s.expiresAt,
        }));
      } else {
        out[key] = u[key];
      }
    }
  }

  return out;
}

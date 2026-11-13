import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.security", req);

    const now = new Date();

    const [failedLogins, blockedAccounts, activeSessions] = await Promise.all([
      db.loginAttempt.findMany({
        where: {
          OR: [
            { attempts: { gt: 0 } },
            { lockoutUntil: { gt: now } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      db.platformUser.findMany({
        where: {
          OR: [
            { isActive: false },
            { deletedAt: { not: null } },
          ],
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          platformRole: true,
          isActive: true,
          deletedAt: true,
          deletedReason: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      db.userSession.findMany({
        where: {
          expiresAt: { gt: now },
          revokedAt: null,
        },
        orderBy: { lastSeenAt: "desc" },
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              platformRole: true,
            },
          },
        },
      }),
    ]);

    const stats = {
      activeSessionsCount: activeSessions.length,
      failedAttemptsCount: failedLogins.reduce((acc, l) => acc + l.attempts, 0),
      lockedIpsCount: failedLogins.filter((l) => l.lockoutUntil && l.lockoutUntil > now).length,
      blockedUsersCount: blockedAccounts.length,
    };

    return NextResponse.json({
      success: true,
      stats,
      failedLogins,
      blockedAccounts,
      activeSessions,
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}

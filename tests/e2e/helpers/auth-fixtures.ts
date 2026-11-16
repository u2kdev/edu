/**
 * Auth & Fixtures Helper for Opaque-Box E2E Testing
 *
 * Provides functions to generate test users, centers, memberships,
 * session tokens, and cleanup fixtures across test suites.
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import { hashPassword, signJWT, hashJti, type PlatformRole, type CenterRole, type JWTPayload } from "@/lib/auth";
import type { CenterStatus } from "@prisma/client";

export interface TestUserOptions {
  email?: string;
  fullName?: string;
  platformRole?: PlatformRole;
  password?: string;
  isActive?: boolean;
}

export interface TestCenterOptions {
  name?: string;
  slug?: string;
  status?: CenterStatus;
  ownerId?: string;
}

export interface TestSessionOptions {
  activeCenterId?: string;
  activeCenterRole?: CenterRole;
  isReadOnly?: boolean;
  impersonatorUserId?: string;
  allowWrite?: boolean;
  maxAgeSeconds?: number;
}

export interface CleanableEntities {
  userIds?: string[];
  centerIds?: string[];
  ticketIds?: string[];
  inviteCodes?: string[];
}

/**
 * Creates a unique test user in the database.
 */
export async function createTestUser(options: TestUserOptions = {}) {
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const email = options.email || `e2e-user-${uniqueSuffix}@test.uz`;
  const fullName = options.fullName || `Test User ${uniqueSuffix}`;
  const password = options.password || "SecureTestPass123!";
  const passwordHash = await hashPassword(password);

  const user = await db.platformUser.create({
    data: {
      email,
      fullName,
      passwordHash,
      platformRole: options.platformRole || "NONE",
      isActive: options.isActive !== undefined ? options.isActive : true,
      emailVerified: new Date(),
    },
  });

  return { ...user, rawPassword: password };
}

/**
 * Creates a learning center in the database.
 */
export async function createTestCenter(options: TestCenterOptions = {}) {
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const name = options.name || `Center ${uniqueSuffix}`;
  const slug = options.slug || `center-${uniqueSuffix}`;

  const center = await db.learningCenter.create({
    data: {
      name,
      slug,
      status: options.status || "ACTIVE",
      ownerId: options.ownerId ?? "",
    },
  });

  return center;
}

/**
 * Creates a center membership for a user in a learning center.
 */
export async function createTestMembership(
  userId: string,
  centerId: string,
  role: CenterRole,
  status: "ACTIVE" | "ARCHIVED" | "SUSPENDED" = "ACTIVE"
) {
  return db.centerMembership.create({
    data: {
      userId,
      centerId,
      role,
      status,
    },
  });
}

/**
 * Generates an authenticated session token for a test user.
 * Creates a real `UserSession` record in the database with a hashed JTI,
 * guaranteeing validity against revocations and session checks.
 */
export async function createTestSessionToken(
  user: { id: string; email: string; platformRole?: string },
  options: TestSessionOptions = {}
): Promise<string> {
  const jti = crypto.randomUUID();
  const maxAgeSeconds = options.maxAgeSeconds || 3600;
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

  const payload: JWTPayload & { isReadOnly?: boolean; allowWrite?: boolean } = {
    userId: user.id,
    email: user.email,
    platformRole: user.platformRole || "NONE",
    activeCenterId: options.activeCenterId,
    activeCenterRole: options.activeCenterRole,
    impersonatorUserId: options.impersonatorUserId,
    isReadOnly: options.isReadOnly,
    allowWrite: options.allowWrite,
    jti,
  };

  const token = signJWT(payload, maxAgeSeconds, jti);

  await db.userSession.create({
    data: {
      userId: user.id,
      jtiHash: hashJti(jti),
      expiresAt,
      ipAddress: "127.0.0.1",
      userAgent: "E2E-Test-Runner/1.0",
    },
  });

  return token;
}

/**
 * Cleans up entities in reverse foreign-key dependency order to prevent FK violations.
 */
export async function cleanupTestEntities(entities: CleanableEntities): Promise<void> {
  const { userIds = [], centerIds = [], ticketIds = [], inviteCodes = [] } = entities;

  try {
    if (ticketIds.length > 0) {
      await db.ticketMessage.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await db.supportTicket.deleteMany({ where: { id: { in: ticketIds } } });
    }

    if (userIds.length > 0) {
      await db.ticketMessage.deleteMany({ where: { senderUserId: { in: userIds } } });
      await db.supportTicket.deleteMany({ where: { creatorUserId: { in: userIds } } });
    }

    if (inviteCodes.length > 0) {
      await db.parentLink.deleteMany({ where: { inviteCodeUsed: { in: inviteCodes } } });
      await db.inviteCode.deleteMany({ where: { code: { in: inviteCodes } } });
    }

    if (centerIds.length > 0) {
      await db.parentLink.deleteMany({
        where: {
          OR: [
            { student: { centerId: { in: centerIds } } },
            { parent: { centerId: { in: centerIds } } },
          ],
        },
      });
      await db.inviteCode.deleteMany({ where: { centerId: { in: centerIds } } });
      await db.attendance.deleteMany({
        where: { student: { centerId: { in: centerIds } } },
      });
      await db.grade.deleteMany({
        where: { student: { centerId: { in: centerIds } } },
      });
      await db.enrollment.deleteMany({ where: { centerId: { in: centerIds } } });
      await db.group.deleteMany({ where: { centerId: { in: centerIds } } });
      await db.course.deleteMany({ where: { centerId: { in: centerIds } } });
      await db.supportTicket.deleteMany({ where: { centerId: { in: centerIds } } });
      await db.centerMembership.deleteMany({ where: { centerId: { in: centerIds } } });
      await db.learningCenter.deleteMany({ where: { id: { in: centerIds } } });
    }

    if (userIds.length > 0) {
      await db.platformAnnouncementRead.deleteMany({ where: { userId: { in: userIds } } });
      await db.platformAnnouncement.deleteMany({ where: { createdBy: { in: userIds } } });
      await db.userSession.deleteMany({ where: { userId: { in: userIds } } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
      await db.centerMembership.deleteMany({ where: { userId: { in: userIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: userIds } } });
    }
  } catch (err) {
    console.warn("Cleanup warning (non-fatal):", err);
  }
}

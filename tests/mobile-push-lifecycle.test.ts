import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as suspendCenter } from "../src/app/api/platform/centers/[id]/suspend/route";
import { PATCH as updateStaff, DELETE as deleteStaff } from "../src/app/api/tenant/staff/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { DELETE as deleteAccount } from "../src/app/api/auth/account/delete/route";
import { POST as mobileLogin } from "../src/app/api/auth/mobile/login/route";
import { hashPassword, signJWT } from "../src/lib/auth";
import { db } from "../src/lib/db";

describe("DevicePushToken Lifecycle & Security Purge", () => {
  let superadminId: string = "";
  let directorId: string = "";
  let studentId: string = "";
  let centerId: string = "";
  let studentMembershipId: string = "";
  let directorMembershipId: string = "";

  const superadminEmail = `superadmin-push-${Date.now()}@test.com`;
  const directorEmail = `director-push-${Date.now()}@test.com`;
  const studentEmail = `student-push-${Date.now()}@test.com`;

  let directorToken: string = "";
  let studentToken: string = "";
  let superadminToken: string = "";

  beforeAll(async () => {
    // 1. Superadmin
    const superadmin = await db.platformUser.create({
      data: {
        email: superadminEmail,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Platform Superadmin",
        platformRole: "SUPERADMIN",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    superadminId = superadmin.id;
    superadminToken = signJWT({
      userId: superadminId,
      email: superadminEmail,
      platformRole: "SUPERADMIN",
    });

    // 2. Director
    const director = await db.platformUser.create({
      data: {
        email: directorEmail,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Director User",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    directorId = director.id;

    // 3. Center
    const center = await db.learningCenter.create({
      data: {
        name: "Push Lifecycle Academy",
        slug: `push-life-${Date.now()}`,
        status: "ACTIVE",
        ownerId: directorId,
      },
    });
    centerId = center.id;

    const dirMem = await db.centerMembership.create({
      data: {
        userId: directorId,
        centerId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    directorMembershipId = dirMem.id;

    // 4. Student
    const student = await db.platformUser.create({
      data: {
        email: studentEmail,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Student Member",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    studentId = student.id;

    const stdMem = await db.centerMembership.create({
      data: {
        userId: studentId,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentMembershipId = stdMem.id;

    directorToken = signJWT({
      userId: directorId,
      email: directorEmail,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "DIRECTOR",
    });

    studentToken = signJWT({
      userId: studentId,
      email: studentEmail,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "STUDENT",
    });
  });

  afterAll(async () => {
    await db.devicePushToken.deleteMany({
      where: { userId: { in: [superadminId, directorId, studentId] } },
    });
    await db.centerMembership.deleteMany({
      where: { userId: { in: [directorId, studentId] } },
    });
    await db.learningCenter.deleteMany({ where: { id: centerId } });
    await db.userSession.deleteMany({
      where: { userId: { in: [superadminId, directorId, studentId] } },
    });
    await db.platformUser.deleteMany({
      where: { id: { in: [superadminId, directorId, studentId] } },
    });
  });

  it("1. Membership Archiving: deletes member's push tokens for this center", async () => {
    // Register token for student
    const tokenRecord = await db.devicePushToken.create({
      data: {
        userId: studentId,
        centerId,
        platform: "android",
        pushToken: `std-archive-token-${Date.now()}`,
      },
    });

    expect(await db.devicePushToken.findUnique({ where: { id: tokenRecord.id } })).not.toBeNull();

    // Director archives student membership
    const archiveReq = new Request(`http://localhost/api/tenant/staff`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${directorToken}`,
        "x-forwarded-for": "127.0.6.1",
      },
      body: JSON.stringify({
        membershipId: studentMembershipId,
        status: "ARCHIVED",
      }),
    });

    const res = await updateStaff(archiveReq);
    expect(res.status).toBe(200);

    // Verify token was deleted
    const tokenAfter = await db.devicePushToken.findUnique({ where: { id: tokenRecord.id } });
    expect(tokenAfter).toBeNull();
  });

  it("2. Center Blocking: deletes all push tokens belonging to the blocked center", async () => {
    // Register token for director in this center
    const dirTokenRecord = await db.devicePushToken.create({
      data: {
        userId: directorId,
        centerId,
        platform: "ios",
        pushToken: `dir-block-token-${Date.now()}`,
      },
    });

    // Block center via platform API
    const blockReq = new Request(`http://localhost/api/platform/centers/${centerId}/suspend`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${superadminToken}`,
        "x-forwarded-for": "127.0.6.2",
      },
      body: JSON.stringify({
        action: "block",
        reason: "Compliance violation",
      }),
    });

    const res = await suspendCenter(blockReq, { params: { id: centerId } });
    expect(res.status).toBe(200);

    // Verify token was purged
    const tokenAfter = await db.devicePushToken.findUnique({ where: { id: dirTokenRecord.id } });
    expect(tokenAfter).toBeNull();
  });

  it("3. Logout: deletes user's push tokens", async () => {
    // Create login session and push token
    const loginRes = await mobileLogin(
      new Request("http://localhost/api/auth/mobile/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "127.0.6.3",
        },
        body: JSON.stringify({
          email: directorEmail,
          password: "MobilePass123!",
          deviceId: "logout-dev-1",
        }),
      })
    );
    const loginData = await loginRes.json();
    const bearer = loginData.token;

    const pushToken = await db.devicePushToken.create({
      data: {
        userId: directorId,
        platform: "ios",
        pushToken: `dir-logout-token-${Date.now()}`,
      },
    });

    // Logout
    const logoutReq = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearer}`,
        "x-forwarded-for": "127.0.6.4",
      },
    });
    const res = await logout(logoutReq);
    expect(res.status).toBe(200);

    expect(await db.devicePushToken.findUnique({ where: { id: pushToken.id } })).toBeNull();
  });

  it("4. Account Deletion: deletes user's push tokens", async () => {
    // Create new student user for deletion
    const delUser = await db.platformUser.create({
      data: {
        email: `del-push-${Date.now()}@test.com`,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Delete Push User",
        emailVerified: new Date(),
        isActive: true,
      },
    });

    const pushToken = await db.devicePushToken.create({
      data: {
        userId: delUser.id,
        platform: "android",
        pushToken: `del-user-token-${Date.now()}`,
      },
    });

    const userToken = signJWT({
      userId: delUser.id,
      email: delUser.email,
      platformRole: "NONE",
    });

    const delReq = new Request("http://localhost/api/auth/account/delete", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${userToken}`,
        "x-forwarded-for": "127.0.6.5",
      },
      body: JSON.stringify({ password: "MobilePass123!" }),
    });

    const res = await deleteAccount(delReq);
    expect(res.status).toBe(200);

    expect(await db.devicePushToken.findUnique({ where: { id: pushToken.id } })).toBeNull();
  });
});

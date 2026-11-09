import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DELETE as deleteAccount } from "../src/app/api/auth/account/delete/route";
import { POST as mobileLogin } from "../src/app/api/auth/mobile/login/route";
import { getAuthSession, hashPassword } from "../src/lib/auth";
import { db } from "../src/lib/db";

describe("Account Deletion Business Rules & Security", () => {
  let soleDirectorUserId: string = "";
  let soleCenterId: string = "";

  let parentUserId: string = "";
  let studentUserId: string = "";
  let parentCenterId: string = "";
  let parentMembershipId: string = "";
  let studentMembershipId: string = "";
  let gradeId: string = "";

  const directorEmail = `sole-director-${Date.now()}@test.com`;
  const parentEmail = `parent-del-${Date.now()}@test.com`;
  const studentEmail = `student-del-${Date.now()}@test.com`;

  beforeAll(async () => {
    // 1. Sole Director Setup
    const soleDirector = await db.platformUser.create({
      data: {
        email: directorEmail,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Sole Director",
        preferredLanguage: "ru",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    soleDirectorUserId = soleDirector.id;

    const soleCenter = await db.learningCenter.create({
      data: {
        name: "Director Only Academy",
        slug: `sole-center-${Date.now()}`,
        status: "ACTIVE",
        ownerId: soleDirectorUserId,
      },
    });
    soleCenterId = soleCenter.id;

    await db.centerMembership.create({
      data: {
        userId: soleDirectorUserId,
        centerId: soleCenterId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    // 2. Parent & Student Setup
    const parent = await db.platformUser.create({
      data: {
        email: parentEmail,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Parent User",
        phone: "+998901234567",
        preferredLanguage: "ru",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    parentUserId = parent.id;

    const student = await db.platformUser.create({
      data: {
        email: studentEmail,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Child Student",
        preferredLanguage: "ru",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    studentUserId = student.id;

    const testCenter = await db.learningCenter.create({
      data: {
        name: "Parent Test Center",
        slug: `parent-center-${Date.now()}`,
        status: "ACTIVE",
        ownerId: parentUserId,
      },
    });
    parentCenterId = testCenter.id;

    // Another director exists so center has coverage
    await db.centerMembership.create({
      data: {
        userId: soleDirectorUserId,
        centerId: parentCenterId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    const parentMem = await db.centerMembership.create({
      data: {
        userId: parentUserId,
        centerId: parentCenterId,
        role: "PARENT",
        status: "ACTIVE",
      },
    });
    parentMembershipId = parentMem.id;

    const studentMem = await db.centerMembership.create({
      data: {
        userId: studentUserId,
        centerId: parentCenterId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentMembershipId = studentMem.id;

    // Link parent and child
    await db.parentLink.create({
      data: {
        parentMembershipId,
        studentMembershipId,
        status: "CONFIRMED",
      },
    });

    // Create course, group, and grade for child to verify persistence
    const course = await db.course.create({
      data: {
        center: { connect: { id: parentCenterId } },
        creator: { connect: { id: parentMembershipId } },
        title: "Algebra I",
      },
    });

    const group = await db.group.create({
      data: {
        centerId: parentCenterId,
        course: { connect: { id: course.id } },
        name: "Group A",
      },
    });

    const grade = await db.grade.create({
      data: {
        centerId: parentCenterId,
        studentMembershipId,
        teacherMembershipId: parentMembershipId,
        value: 95,
        gradeType: "HOMEWORK",
      },
    });
    gradeId = grade.id;
  });

  afterAll(async () => {
    if (gradeId) await db.grade.deleteMany({ where: { id: gradeId } });
    if (parentMembershipId || studentMembershipId) {
      await db.parentLink.deleteMany({
        where: {
          OR: [{ parentMembershipId }, { studentMembershipId }],
        },
      });
    }
    await db.group.deleteMany({ where: { centerId: parentCenterId } });
    await db.course.deleteMany({ where: { centerId: parentCenterId } });
    await db.centerMembership.deleteMany({
      where: {
        userId: { in: [soleDirectorUserId, parentUserId, studentUserId] },
      },
    });
    await db.learningCenter.deleteMany({
      where: { id: { in: [soleCenterId, parentCenterId] } },
    });
    await db.devicePushToken.deleteMany({
      where: {
        userId: { in: [soleDirectorUserId, parentUserId, studentUserId] },
      },
    });
    await db.userSession.deleteMany({
      where: {
        userId: { in: [soleDirectorUserId, parentUserId, studentUserId] },
      },
    });
    await db.platformUser.deleteMany({
      where: {
        id: { in: [soleDirectorUserId, parentUserId, studentUserId] },
      },
    });
  });

  const getLoginToken = async (email: string, ipSuffix: number) => {
    const res = await mobileLogin(
      new Request("http://localhost/api/auth/mobile/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `127.0.5.${ipSuffix}`,
        },
        body: JSON.stringify({
          email,
          password: "MobilePass123!",
          deviceId: `del-dev-${ipSuffix}`,
        }),
      })
    );
    const data = await res.json();
    return data.token as string;
  };

  it("requires password confirmation to delete account", async () => {
    const token = await getLoginToken(parentEmail, 1);

    const res = await deleteAccount(
      new Request("http://localhost/api/auth/account/delete", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-forwarded-for": "127.0.5.2",
        },
        body: JSON.stringify({ password: "WrongPassword!" }),
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("sole DIRECTOR cannot delete account (returns 409 SOLE_DIRECTOR_CONFLICT)", async () => {
    const token = await getLoginToken(directorEmail, 3);

    const res = await deleteAccount(
      new Request("http://localhost/api/auth/account/delete", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-forwarded-for": "127.0.5.4",
        },
        body: JSON.stringify({ password: "MobilePass123!" }),
      })
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe("SOLE_DIRECTOR_CONFLICT");
  });

  it("successfully soft-deletes parent account: anonymizes, severs parent links, preserves grades", async () => {
    // Add device push token for parent to verify removal
    await db.devicePushToken.create({
      data: {
        userId: parentUserId,
        platform: "android",
        pushToken: `parent-push-${Date.now()}`,
      },
    });

    const token = await getLoginToken(parentEmail, 5);

    const res = await deleteAccount(
      new Request("http://localhost/api/auth/account/delete", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-forwarded-for": "127.0.5.6",
        },
        body: JSON.stringify({ password: "MobilePass123!" }),
      })
    );

    expect(res.status).toBe(200);

    // 1. User is anonymized
    const userInDb = await db.platformUser.findUnique({
      where: { id: parentUserId },
    });
    expect(userInDb?.isActive).toBe(false);
    expect(userInDb?.phone).toBeNull();
    expect(userInDb?.email).toContain("@deleted.local");
    expect(userInDb?.fullName).toBe("Deleted User");

    // 2. Parent links severed
    const activeLinks = await db.parentLink.count({
      where: { parentMembershipId },
    });
    expect(activeLinks).toBe(0);

    // 3. Child grade is preserved!
    const gradeInDb = await db.grade.findUnique({ where: { id: gradeId } });
    expect(gradeInDb).not.toBeNull();
    expect(gradeInDb?.value).toBe(95);

    // 4. All push tokens and sessions removed
    const pushTokens = await db.devicePushToken.count({
      where: { userId: parentUserId },
    });
    expect(pushTokens).toBe(0);

    const activeSessions = await db.userSession.count({
      where: { userId: parentUserId, revokedAt: null },
    });
    expect(activeSessions).toBe(0);
  });
});

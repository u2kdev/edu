import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashJti } from "../src/lib/auth";
import { checkSubscriptionLimit } from "../src/lib/limits";
import { POST as onboardingPost } from "../src/app/api/tenant/onboarding/route";
import { POST as centerPaymentsPost } from "../src/app/api/center-payments/route";
import { GET as centerPaymentsReportGet } from "../src/app/api/center-payments/report/route";

function buildSessionReq(url: string, method: string, token: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      cookie: `auth_token=${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Stage P1a §0 Preparation checks", () => {
  let centerId = "";
  let planId = "";
  let directorId = "";
  let directorToken = "";
  let studentMembershipId = "";
  let archivedTeacherUserId = "";
  let studentUserId = "";

  beforeAll(async () => {
    const uniq = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const plan = await db.subscriptionPlan.create({
      data: {
        name: `P1a Prep Plan ${uniq}`,
        maxStudents: 50,
        maxTeachers: 1,
        maxCourses: 10,
        maxBranches: 1,
        priceMonthly: 300000,
      },
    });
    planId = plan.id;

    const director = await db.platformUser.create({
      data: {
        email: `p1a-prep-dir-${uniq}@test.com`,
        fullName: "P1a Prep Director",
        passwordHash: "hash",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    directorId = director.id;

    const center = await db.learningCenter.create({
      data: {
        name: `P1a Prep Center ${uniq}`,
        slug: `p1a-prep-${uniq}`,
        ownerId: directorId,
        status: "ACTIVE",
        timeZone: "Asia/Tashkent",
      },
    });
    centerId = center.id;

    await db.subscription.create({
      data: {
        centerId,
        planId,
        status: "ACTIVE",
        currentPeriodStartsAt: new Date(),
        currentPeriodEndsAt: new Date(Date.now() + 30 * 86400000),
      },
    });

    await db.centerMembership.create({
      data: {
        centerId,
        userId: directorId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    const studentUser = await db.platformUser.create({
      data: {
        email: `p1a-prep-std-${uniq}@test.com`,
        fullName: "P1a Prep Student",
        passwordHash: "hash",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    studentUserId = studentUser.id;
    const stdM = await db.centerMembership.create({
      data: {
        centerId,
        userId: studentUserId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentMembershipId = stdM.id;

    const archivedTeacher = await db.platformUser.create({
      data: {
        email: `p1a-prep-tch-${uniq}@test.com`,
        fullName: "Archived Teacher",
        passwordHash: "hash",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    archivedTeacherUserId = archivedTeacher.id;
    await db.centerMembership.create({
      data: {
        centerId,
        userId: archivedTeacherUserId,
        role: "TEACHER",
        status: "ARCHIVED",
      },
    });

    const jti = `prep-jti-${uniq}`;
    await db.userSession.create({
      data: {
        userId: directorId,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() + 86400000),
        ipAddress: "127.0.0.1",
      },
    });
    directorToken = signJWT(
      {
        userId: directorId,
        email: director.email,
        platformRole: "NONE",
        activeCenterId: centerId,
        activeCenterRole: "DIRECTOR",
      },
      "7d",
      jti
    );
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (centerId) {
      await db.financeTransaction.deleteMany({ where: { centerId } });
      await db.centerPayment.deleteMany({ where: { centerId } });
      await db.auditLog.deleteMany({ where: { centerId } });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.subscription.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    if (planId) await db.subscriptionPlan.deleteMany({ where: { id: planId } });
    await db.userSession.deleteMany({ where: { userId: { in: [directorId] } } });
    await db.platformUser.deleteMany({
      where: { id: { in: [directorId, studentUserId, archivedTeacherUserId].filter(Boolean) } },
    });
  });

  it("closes /api/tenant/onboarding with 403/404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await onboardingPost(
      buildSessionReq("/api/tenant/onboarding", "POST", directorToken, {
        name: "Unauthorized Self Center",
        slug: `unauth-self-${Date.now()}`,
      })
    );
    expect([403, 404]).toContain(res.status);
  });

  it("leaves paidAt = null when CenterPayment is created with status PENDING", async () => {
    vi.unstubAllEnvs();
    const res = await centerPaymentsPost(
      buildSessionReq("/api/center-payments", "POST", directorToken, {
        studentMembershipId,
        amount: 250000,
        status: "PENDING",
        paymentMethod: "CASH",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.payment.status).toBe("PENDING");
    expect(data.payment.paidAt).toBeNull();
  });

  it("/api/center-payments/report does NOT use hardcoded 150000 fallback when paidCount is 0", async () => {
    vi.unstubAllEnvs();
    const res = await centerPaymentsReportGet(
      buildSessionReq("/api/center-payments/report", "GET", directorToken)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.report.paidCount).toBe(0);
    expect(data.report.expectedMRR).toBe(0);
  });

  it("checkSubscriptionLimit('teachers') excludes ARCHIVED teachers", async () => {
    const allowed = await checkSubscriptionLimit(centerId, "teachers", 1);
    expect(allowed).toBe(true);
  });
});

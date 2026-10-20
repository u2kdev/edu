import { describe, it, expect, beforeAll, vi } from "vitest";
import { POST as loginUser } from "../src/app/api/auth/login/route";
import { GET as getMe } from "../src/app/api/auth/me/route";
import { requireTenantPageAccess } from "../src/lib/tenant";
import { getAuthSession } from "../src/lib/auth";
import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

let currentCookie: string = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: currentCookie };
      return undefined;
    },
    set: (name: string, value: string) => {
      if (name === "auth_token") currentCookie = value;
    },
    delete: () => {
      currentCookie = "";
    },
  }),
}));

const mockReq = (body: unknown, ip: string = "127.0.0.1") => {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
};

describe("Demo Roles: Login and Panel Access Verification", () => {
  const seedPassword = process.env.DEV_SEED_PASSWORD || "Password123!";

  beforeAll(async () => {
    // Ensure demo accounts exist in the test database
    const passwordHash = await bcrypt.hash(seedPassword, 10);
    const now = new Date();

    // 1. Superadmin
    await db.platformUser.upsert({
      where: { email: "admin@platform.com" },
      update: { passwordHash, platformRole: "SUPERADMIN", emailVerified: now, isActive: true },
      create: { email: "admin@platform.com", passwordHash, fullName: "Алексей Громов", platformRole: "SUPERADMIN", emailVerified: now, isActive: true },
    });

    // 2. Plan
    const plan = await db.subscriptionPlan.upsert({
      where: { id: "plan-pro" },
      update: {},
      create: { id: "plan-pro", name: "Профессиональный", maxStudents: 250, maxTeachers: 20, maxCourses: 50, priceMonthly: 7900 },
    });

    // 3. Center 1 (ACTIVE) and Center 2 (TRIAL)
    const centers = [
      { slug: "center-1", name: "Toshkent IT Academy", status: "ACTIVE" as const, dEmail: "director1@example.com", dName: "Alisher Navoiyev", tPrefix: "c1", sPrefix: "c1", pPrefix: "c1" },
      { slug: "center-2", name: "Samarqand Digital School", status: "TRIAL" as const, dEmail: "director2@example.com", dName: "Bobur Mirzo", tPrefix: "c2", sPrefix: "c2", pPrefix: "c2" },
    ];

    for (const c of centers) {
      const director = await db.platformUser.upsert({
        where: { email: c.dEmail },
        update: { passwordHash, emailVerified: now, isActive: true },
        create: { email: c.dEmail, passwordHash, fullName: c.dName, emailVerified: now, isActive: true },
      });

      const center = await db.learningCenter.upsert({
        where: { slug: c.slug },
        update: { status: c.status },
        create: { slug: c.slug, name: c.name, status: c.status, ownerId: director.id },
      });

      await db.subscription.upsert({
        where: { id: `sub-${c.slug}` },
        update: { status: c.status },
        create: {
          id: `sub-${c.slug}`,
          centerId: center.id,
          planId: plan.id,
          status: c.status,
          currentPeriodStartsAt: now,
          currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const dMem = await db.centerMembership.upsert({
        where: { userId_centerId_role: { userId: director.id, centerId: center.id, role: "DIRECTOR" } },
        update: { status: "ACTIVE" },
        create: { userId: director.id, centerId: center.id, role: "DIRECTOR", status: "ACTIVE" },
      });

      // Teacher
      const tUser = await db.platformUser.upsert({
        where: { email: `${c.tPrefix}-teacher1@example.com` },
        update: { passwordHash, emailVerified: now, isActive: true },
        create: { email: `${c.tPrefix}-teacher1@example.com`, passwordHash, fullName: "Anvar Qodirov", emailVerified: now, isActive: true },
      });
      await db.centerMembership.upsert({
        where: { userId_centerId_role: { userId: tUser.id, centerId: center.id, role: "TEACHER" } },
        update: { status: "ACTIVE" },
        create: { userId: tUser.id, centerId: center.id, role: "TEACHER", status: "ACTIVE" },
      });

      // Student
      const sUser = await db.platformUser.upsert({
        where: { email: `${c.sPrefix}-student1@example.com` },
        update: { passwordHash, emailVerified: now, isActive: true },
        create: { email: `${c.sPrefix}-student1@example.com`, passwordHash, fullName: "Jasur Abdullayev", emailVerified: now, isActive: true },
      });
      const sMem = await db.centerMembership.upsert({
        where: { userId_centerId_role: { userId: sUser.id, centerId: center.id, role: "STUDENT" } },
        update: { status: "ACTIVE" },
        create: { userId: sUser.id, centerId: center.id, role: "STUDENT", status: "ACTIVE" },
      });

      // Parent
      const pUser = await db.platformUser.upsert({
        where: { email: `${c.pPrefix}-parent1@example.com` },
        update: { passwordHash, emailVerified: now, isActive: true },
        create: { email: `${c.pPrefix}-parent1@example.com`, passwordHash, fullName: "Abdullayev Ota", emailVerified: now, isActive: true },
      });
      const pMem = await db.centerMembership.upsert({
        where: { userId_centerId_role: { userId: pUser.id, centerId: center.id, role: "PARENT" } },
        update: { status: "ACTIVE" },
        create: { userId: pUser.id, centerId: center.id, role: "PARENT", status: "ACTIVE" },
      });

      await db.parentLink.upsert({
        where: { parentMembershipId_studentMembershipId: { parentMembershipId: pMem.id, studentMembershipId: sMem.id } },
        update: { status: "CONFIRMED" },
        create: { parentMembershipId: pMem.id, studentMembershipId: sMem.id, status: "CONFIRMED", confirmedAt: now },
      });

      // Course
      await db.course.upsert({
        where: { id: `course-${c.slug}-1` },
        update: {},
        create: {
          id: `course-${c.slug}-1`,
          centerId: center.id,
          title: "Frontend Bootcamp",
          isPublished: true,
          createdByMembershipId: dMem.id,
        },
      });
    }
  });

  it("1. Superadmin logs in with seed password and gets platform session", async () => {
    currentCookie = "";
    const res = await loginUser(mockReq({ email: "admin@platform.com", password: seedPassword }));
    expect(res.status).toBe(200);
    expect(currentCookie).toBeTruthy();

    const meRes = await getMe();
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.authenticated).toBe(true);
    expect(meData.session.user.platformRole).toBe("SUPERADMIN");
  });

  it("2. Director of Center 1 (ACTIVE) logs in and gets center panel access as DIRECTOR", async () => {
    currentCookie = "";
    const res = await loginUser(mockReq({ email: "director1@example.com", password: seedPassword }));
    expect(res.status).toBe(200);
    expect(currentCookie).toBeTruthy();

    const tenantCtx = await requireTenantPageAccess();
    expect(tenantCtx.role).toBe("DIRECTOR");
    expect(tenantCtx.center.status).toBe("ACTIVE");
    expect(tenantCtx.center.slug).toBe("center-1");
  });

  it("3. Teacher of Center 1 logs in and gets center panel access as TEACHER", async () => {
    currentCookie = "";
    const res = await loginUser(mockReq({ email: "c1-teacher1@example.com", password: seedPassword }));
    expect(res.status).toBe(200);
    expect(currentCookie).toBeTruthy();

    const tenantCtx = await requireTenantPageAccess();
    expect(tenantCtx.role).toBe("TEACHER");
    expect(tenantCtx.center.slug).toBe("center-1");
  });

  it("4. Student of Center 1 logs in and gets center panel access as STUDENT", async () => {
    currentCookie = "";
    const res = await loginUser(mockReq({ email: "c1-student1@example.com", password: seedPassword }));
    expect(res.status).toBe(200);
    expect(currentCookie).toBeTruthy();

    const tenantCtx = await requireTenantPageAccess();
    expect(tenantCtx.role).toBe("STUDENT");
    expect(tenantCtx.center.slug).toBe("center-1");
  });

  it("5. Parent of Center 1 logs in and gets center panel access as PARENT", async () => {
    currentCookie = "";
    const res = await loginUser(mockReq({ email: "c1-parent1@example.com", password: seedPassword }));
    expect(res.status).toBe(200);
    expect(currentCookie).toBeTruthy();

    const tenantCtx = await requireTenantPageAccess();
    expect(tenantCtx.role).toBe("PARENT");
    expect(tenantCtx.center.slug).toBe("center-1");
  });

  it("6. Director of Center 2 (TRIAL) logs in and gets center panel access as DIRECTOR", async () => {
    currentCookie = "";
    const res = await loginUser(mockReq({ email: "director2@example.com", password: seedPassword }));
    expect(res.status).toBe(200);
    expect(currentCookie).toBeTruthy();

    const tenantCtx = await requireTenantPageAccess();
    expect(tenantCtx.role).toBe("DIRECTOR");
    expect(tenantCtx.center.status).toBe("TRIAL");
    expect(tenantCtx.center.slug).toBe("center-2");
  });

  it("7. Mutation test: user with emailVerified=null cannot log in (returns 403 EMAIL_NOT_VERIFIED)", async () => {
    // Temporarily mutate user to have unverified email
    await db.platformUser.update({
      where: { email: "c1-student1@example.com" },
      data: { emailVerified: null },
    });

    currentCookie = "";
    const res = await loginUser(mockReq({ email: "c1-student1@example.com", password: seedPassword }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("EMAIL_NOT_VERIFIED");

    // Restore verification
    await db.platformUser.update({
      where: { email: "c1-student1@example.com" },
      data: { emailVerified: new Date() },
    });

    // Verify it passes again
    const resRestored = await loginUser(mockReq({ email: "c1-student1@example.com", password: seedPassword }));
    expect(resRestored.status).toBe(200);
  });
});

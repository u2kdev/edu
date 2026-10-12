import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as loginPost } from "../src/app/api/auth/login/route";
import { POST as resendConfirmPost } from "../src/app/api/auth/resend-confirm/route";
import { requireTenantAccess } from "../src/lib/tenant";
import { db } from "../src/lib/db";
import { hashPassword, signJWT } from "../src/lib/auth";
import { vi } from "vitest";

const mockSet = vi.fn();
const mockDelete = vi.fn();
let currentCookieToken: string | undefined = undefined;

vi.mock("next/headers", () => ({
  cookies: () => ({
    set: (name: string, val: string) => {
      if (name === "auth_token") currentCookieToken = val;
      mockSet(name, val);
    },
    get: (name: string) => (name === "auth_token" && currentCookieToken ? { value: currentCookieToken } : undefined),
    delete: mockDelete,
  }),
}));

describe("Login and Tenant API Email Verification Enforcement", () => {
  const timestamp = Date.now();
  const unverifiedStudentEmail = `unverified-student-${timestamp}@test.com`;
  const unverifiedAdminEmail = `unverified-admin-${timestamp}@test.com`;
  const verifiedUserEmail = `verified-user-${timestamp}@test.com`;
  const password = "Password123!";

  let unverifiedStudentId: string;
  let unverifiedAdminId: string;
  let verifiedUserId: string;
  let centerId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);

    // 1. Unverified regular user (platformRole: "NONE", emailVerified: null)
    const studentUser = await db.platformUser.create({
      data: {
        email: unverifiedStudentEmail,
        passwordHash,
        fullName: "Unverified Student",
        platformRole: "NONE",
        emailVerified: null,
      },
    });
    unverifiedStudentId = studentUser.id;

    // 2. Unverified platform staff user (platformRole: "DEVELOPER", emailVerified: null)
    const adminUser = await db.platformUser.create({
      data: {
        email: unverifiedAdminEmail,
        passwordHash,
        fullName: "Platform Admin",
        platformRole: "DEVELOPER",
        emailVerified: null,
      },
    });
    unverifiedAdminId = adminUser.id;

    // 3. Verified user
    const verifiedUser = await db.platformUser.create({
      data: {
        email: verifiedUserEmail,
        passwordHash,
        fullName: "Verified User",
        platformRole: "NONE",
        emailVerified: new Date(),
      },
    });
    verifiedUserId = verifiedUser.id;

    // 4. Learning center
    const center = await db.learningCenter.create({
      data: {
        name: `Test Center ${timestamp}`,
        slug: `center-${timestamp}`,
        owner: { connect: { id: verifiedUserId } },
      },
    });
    centerId = center.id;

    // 5. Create memberships
    await db.centerMembership.create({
      data: {
        userId: unverifiedStudentId,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    await db.centerMembership.create({
      data: {
        userId: verifiedUserId,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    if (centerId) {
      await db.centerMembership.deleteMany({
        where: { centerId },
      });
      await db.learningCenter.deleteMany({
        where: { id: centerId },
      });
    }
    await db.platformUser.deleteMany({
      where: {
        email: {
          in: [unverifiedStudentEmail, unverifiedAdminEmail, verifiedUserEmail],
        },
      },
    });
  });

  const mockLoginReq = (email: string, pw: string) =>
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `192.168.10.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({ email, password: pw }),
    });

  it("blocks login for unverified regular user with 403 EMAIL_NOT_VERIFIED", async () => {
    const res = await loginPost(mockLoginReq(unverifiedStudentEmail, password));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error?.code).toBe("EMAIL_NOT_VERIFIED");

    // Allows resending confirmation email
    const resendRes = await resendConfirmPost(
      new Request("http://localhost/api/auth/resend-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1" },
        body: JSON.stringify({ email: unverifiedStudentEmail }),
      })
    );
    expect(resendRes.status).toBe(200);
  });

  it("allows login for platform-created roles even if emailVerified is null", async () => {
    const res = await loginPost(mockLoginReq(unverifiedAdminEmail, password));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user?.email).toBe(unverifiedAdminEmail);
  });

  it("preserves registered membership in DB, but blocks tenant API access when emailVerified is null", async () => {
    // 1. Membership exists in database
    const membership = await db.centerMembership.findFirst({
      where: { userId: unverifiedStudentId, centerId },
    });
    expect(membership).not.toBeNull();
    expect(membership?.status).toBe("ACTIVE");

    // 2. Mock request with unverified student's auth cookie
    const token = signJWT({
      userId: unverifiedStudentId,
      email: unverifiedStudentEmail,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "STUDENT",
    });
    currentCookieToken = token;

    const tenantReq = new Request("http://localhost/api/attendance", {
      method: "GET",
      headers: {
        cookie: `auth_token=${token}`,
      },
    });

    await expect(requireTenantAccess(tenantReq, centerId)).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
  });

  it("allows login and tenant API access when emailVerified is set", async () => {
    const loginRes = await loginPost(mockLoginReq(verifiedUserEmail, password));
    expect(loginRes.status).toBe(200);

    const token = signJWT({
      userId: verifiedUserId,
      email: verifiedUserEmail,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "STUDENT",
    });
    currentCookieToken = token;

    const tenantReq = new Request("http://localhost/api/attendance", {
      method: "GET",
      headers: {
        cookie: `auth_token=${token}`,
      },
    });

    const access = await requireTenantAccess(tenantReq, centerId);
    expect(access.center.id).toBe(centerId);
    expect(access.role).toBe("STUDENT");
  });
});

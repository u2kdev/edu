import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "../src/lib/db";
import { comparePassword } from "../src/lib/auth";
import { GET, POST } from "../src/app/api/platform/first-owner/route";

const TEST_SETUP_TOKEN = "super-secret-setup-token-min-16-chars";

const mockRequest = (
  url: string,
  method: "GET" | "POST",
  body?: unknown,
  ip: string = "127.0.0.1",
  token: string = TEST_SETUP_TOKEN
) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
      ...(token ? { "x-setup-token": token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("LAUNCH-1 Item 5: First platform owner setup", () => {
  const originalEnv = { ...process.env };
  let createdUserIds: string[] = [];

  beforeEach(async () => {
    process.env.SETUP_TOKEN = TEST_SETUP_TOKEN;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";

    // Remove superadmins to test initial platform state
    const superadmins = await db.platformUser.findMany({
      where: { platformRole: "SUPERADMIN" },
      select: { id: true },
    });
    createdUserIds = superadmins.map((u) => u.id);
    if (createdUserIds.length > 0) {
      await db.learningCenter.deleteMany({
        where: { ownerId: { in: createdUserIds } },
      });
      await db.userSession.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await db.auditLog.deleteMany({
        where: { actorUserId: { in: createdUserIds } },
      });
      await db.platformUser.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    if (createdUserIds.length > 0) {
      await db.learningCenter.deleteMany({
        where: { ownerId: { in: createdUserIds } },
      });
      await db.userSession.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await db.auditLog.deleteMany({
        where: { actorUserId: { in: createdUserIds } },
      });
      await db.platformUser.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  it("GET returns canInitialize: true when no superadmin exists, 404 once created", async () => {
    const reqBefore = mockRequest("/api/platform/first-owner", "GET");
    const resBefore = await GET(reqBefore);
    const dataBefore = await resBefore.json();
    expect(resBefore.status).toBe(200);
    expect(dataBefore.canInitialize).toBe(true);

    const testPassword = "Password123!";
    const resCreate = await POST(
      mockRequest("/api/platform/first-owner", "POST", {
        email: `first-owner-${Date.now()}@platform.uz`,
        password: testPassword,
        fullName: "Platform Founder",
      }, "10.1.1.1")
    );
    expect(resCreate.status).toBe(201);
    const createdBody = await resCreate.json();
    createdUserIds.push(createdBody.user.id);

    const reqAfter = mockRequest("/api/platform/first-owner", "GET");
    const resAfter = await GET(reqAfter);
    expect(resAfter.status).toBe(404);
  });

  it("POST creates first superadmin, hashes password, and never stores or logs plaintext password", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const testPassword = "SuperSecurePassword2026!";
    const email = `owner-secure-${Date.now()}@platform.uz`;

    const res = await POST(
      mockRequest("/api/platform/first-owner", "POST", {
        email,
        password: testPassword,
        fullName: "Secure Founder",
      }, "10.1.1.2")
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe(email);
    expect(body.user.password).toBeUndefined();
    createdUserIds.push(body.user.id);

    // Verify user in DB
    const userInDb = await db.platformUser.findUnique({
      where: { id: body.user.id },
    });
    expect(userInDb).toBeDefined();
    expect(userInDb?.platformRole).toBe("SUPERADMIN");
    expect(userInDb?.passwordHash).not.toBe(testPassword);
    const matches = await comparePassword(testPassword, userInDb?.passwordHash || "");
    expect(matches).toBe(true);

    // Verify audit log has no plaintext password
    const audit = await db.auditLog.findFirst({
      where: {
        actorUserId: userInDb?.id,
        action: "PLATFORM_FIRST_OWNER_CREATED",
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.detailsJson).not.toContain(testPassword);

    // Verify console logs never printed the plaintext password
    for (const call of consoleSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(testPassword);
    }
    consoleSpy.mockRestore();
  });

  it("POST returns 404 Not Found once a superadmin already exists", async () => {
    const res1 = await POST(
      mockRequest("/api/platform/first-owner", "POST", {
        email: `first-${Date.now()}@platform.uz`,
        password: "Password123!",
        fullName: "First SuperAdmin",
      }, "10.1.1.3")
    );
    expect(res1.status).toBe(201);
    const body1 = await res1.json();
    createdUserIds.push(body1.user.id);

    // Second attempt must fail with 404 Not Found
    const res2 = await POST(
      mockRequest("/api/platform/first-owner", "POST", {
        email: `second-${Date.now()}@platform.uz`,
        password: "Password123!",
        fullName: "Intruder SuperAdmin",
      }, "10.1.1.4")
    );
    expect(res2.status).toBe(404);
    const body2 = await res2.json();
    expect(body2.error).toBe("Not Found");
  });

  it("POST rejects weak passwords with 400 Bad Request", async () => {
    const res = await POST(
      mockRequest("/api/platform/first-owner", "POST", {
        email: `founder-weak-${Date.now()}@platform.uz`,
        password: "short",
        fullName: "Weak Founder",
      }, "10.1.1.5")
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

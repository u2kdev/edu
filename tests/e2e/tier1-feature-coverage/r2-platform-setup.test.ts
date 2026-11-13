import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/platform/first-owner/route";
import SetupPage from "@/app/setup/page";
import { createRequest, invokeRoute } from "../helpers/e2e-client";
import { assertNoForbiddenKeys } from "../helpers/recursive-key-scanner";

const TEST_SETUP_TOKEN = "test-secure-setup-token-2026-xyz";

describe("Tier 1 Feature Coverage: R2 Platform First-Owner Setup", () => {
  const originalEnv = { ...process.env };
  const createdUserIds: string[] = [];

  const setNodeEnv = (env: string) => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: env,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  };

  beforeEach(async () => {
    await db.rateLimitRecord.deleteMany();
    process.env.SETUP_TOKEN = TEST_SETUP_TOKEN;
    setNodeEnv("test");

    // Clean existing superadmins to test initial state
    const superadmins = await db.platformUser.findMany({
      where: { platformRole: "SUPERADMIN" },
      select: { id: true },
    });
    const ids = superadmins.map((u) => u.id);
    if (ids.length > 0) {
      await db.learningCenter.deleteMany({ where: { ownerId: { in: ids } } });
      await db.userSession.deleteMany({ where: { userId: { in: ids } } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
      await db.platformUser.deleteMany({ where: { id: { in: ids } } });
    }
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await db.learningCenter.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await db.userSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    process.env = { ...originalEnv };
  });

  /**
   * TC-R2-01: Successful Initial Setup with Valid SETUP_TOKEN
   */
  it("TC-R2-01: Valid token creates SUPERADMIN, returns 201 without sensitive credentials", async () => {
    const email = `owner-${Date.now()}@platform.uz`;
    const password = "SuperSecurePassword2026!";

    const res = await invokeRoute<{
      success: boolean;
      user: { id: string; email: string; fullName: string; platformRole: string };
    }>(
      POST,
      "/api/platform/first-owner",
      {
        method: "POST",
        headers: { "x-setup-token": TEST_SETUP_TOKEN },
        body: {
          email,
          password,
          fullName: "Platform Founder",
        },
      }
    );

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
    expect(res.data.user.email).toBe(email);
    expect(res.data.user.platformRole).toBe("SUPERADMIN");

    // Assert no forbidden secrets in response payload
    assertNoForbiddenKeys(res.data, "TC-R2-01 response");

    createdUserIds.push(res.data.user.id);

    // Database verification: user exists with role SUPERADMIN and hashed password
    const userInDb = await db.platformUser.findUnique({
      where: { id: res.data.user.id },
    });
    expect(userInDb).toBeDefined();
    expect(userInDb?.platformRole).toBe("SUPERADMIN");
    expect(userInDb?.passwordHash).not.toBe(password);

    // AuditLog verification: action recorded and details omit plaintext password
    const audit = await db.auditLog.findFirst({
      where: {
        actorUserId: res.data.user.id,
        action: "PLATFORM_FIRST_OWNER_CREATED",
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.detailsJson).not.toContain(password);
  });

  /**
   * TC-R2-02: Missing or Invalid SETUP_TOKEN Returns 404 Stealth
   */
  it("TC-R2-02: Missing or invalid SETUP_TOKEN returns 404 and does not create user", async () => {
    // 2a: Missing header
    const missingTokenRes = await invokeRoute(
      POST,
      "/api/platform/first-owner",
      {
        method: "POST",
        body: {
          email: `attacker-missing-${Date.now()}@platform.uz`,
          password: "Password123!",
          fullName: "Attacker",
        },
      }
    );
    expect(missingTokenRes.status).toBe(404);

    // 2b: Invalid token
    const invalidTokenRes = await invokeRoute(
      POST,
      "/api/platform/first-owner",
      {
        method: "POST",
        headers: { "x-setup-token": "wrong-token-guess" },
        body: {
          email: `attacker-invalid-${Date.now()}@platform.uz`,
          password: "Password123!",
          fullName: "Attacker",
        },
      }
    );
    expect(invalidTokenRes.status).toBe(404);

    // DB state assertion: zero superadmins created
    const count = await db.platformUser.count({
      where: { platformRole: "SUPERADMIN" },
    });
    expect(count).toBe(0);
  });

  /**
   * TC-R2-03: Post-Creation Permanent Lockdown
   */
  it("TC-R2-03: Once superadmin exists, setup endpoints and page return 404 permanently", async () => {
    // Step 1: Create initial legitimate superadmin
    const initRes = await invokeRoute<{ user: { id: string } }>(
      POST,
      "/api/platform/first-owner",
      {
        method: "POST",
        headers: { "x-setup-token": TEST_SETUP_TOKEN },
        body: {
          email: `legit-owner-${Date.now()}@platform.uz`,
          password: "SecurePassword123!",
          fullName: "Original Owner",
        },
      }
    );
    expect(initRes.status).toBe(201);
    createdUserIds.push(initRes.data.user.id);

    // Step 2: POST /api/platform/first-owner returns 404 (NOT 403)
    const secondPost = await invokeRoute(
      POST,
      "/api/platform/first-owner",
      {
        method: "POST",
        headers: { "x-setup-token": TEST_SETUP_TOKEN },
        body: {
          email: `intruder-${Date.now()}@platform.uz`,
          password: "AnotherPassword123!",
          fullName: "Intruder",
        },
      }
    );
    expect(secondPost.status).toBe(404);

    // Step 3: GET /api/platform/first-owner returns 404
    const getRes = await invokeRoute(
      GET,
      "/api/platform/first-owner",
      {
        method: "GET",
        headers: { "x-setup-token": TEST_SETUP_TOKEN },
      }
    );
    expect(getRes.status).toBe(404);

    // Step 4: GET /setup page invokes notFound()
    await expect(
      SetupPage({ searchParams: Promise.resolve({ token: TEST_SETUP_TOKEN }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  /**
   * TC-R2-04: Public GET Does Not Reveal Initialization State
   */
  it("TC-R2-04: Public GET without token returns 404 in both initialized and uninitialized states", async () => {
    // State A: 0 superadmins, unauthenticated GET
    const resStateA = await invokeRoute(GET, "/api/platform/first-owner", { method: "GET" });
    expect(resStateA.status).toBe(404);

    // Create a superadmin
    const createRes = await invokeRoute<{ user: { id: string } }>(
      POST,
      "/api/platform/first-owner",
      {
        method: "POST",
        headers: { "x-setup-token": TEST_SETUP_TOKEN },
        body: {
          email: `state-b-owner-${Date.now()}@platform.uz`,
          password: "SecurePassword123!",
          fullName: "State B Owner",
        },
      }
    );
    expect(createRes.status).toBe(201);
    createdUserIds.push(createRes.data.user.id);

    // State B: >=1 superadmin, unauthenticated GET
    const resStateB = await invokeRoute(GET, "/api/platform/first-owner", { method: "GET" });
    expect(resStateB.status).toBe(404);
  });

  /**
   * TC-R2-05: Unconfigured SETUP_TOKEN in Production Disables Setup (Fail-Closed)
   */
  it("TC-R2-05: Missing SETUP_TOKEN in production environment disables setup (returns 404)", async () => {
    setNodeEnv("production");
    delete process.env.SETUP_TOKEN;

    const res = await invokeRoute(
      POST,
      "/api/platform/first-owner",
      {
        method: "POST",
        headers: { "x-setup-token": "any-token-attempt" },
        body: {
          email: `prod-takeover-${Date.now()}@platform.uz`,
          password: "SecurePassword123!",
          fullName: "Prod Attacker",
        },
      }
    );
    expect(res.status).toBe(404);

    const superadmins = await db.platformUser.count({
      where: { platformRole: "SUPERADMIN" },
    });
    expect(superadmins).toBe(0);
  });
});

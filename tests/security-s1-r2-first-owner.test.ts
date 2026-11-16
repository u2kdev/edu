import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "../src/lib/db";
import { GET, POST } from "../src/app/api/platform/first-owner/route";
import { verifySetupTokenValue } from "../src/lib/setup-token";

const TEST_SETUP_TOKEN = "super-secret-setup-token-min-16-chars";

const mockRequest = (
  url: string,
  method: "GET" | "POST",
  body?: unknown,
  headers: Record<string, string> = {}
) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("TDD Attack Suite: R2 Platform First-Owner Setup Hardening", () => {
  const originalEnv = { ...process.env };
  let createdUserIds: string[] = [];

  beforeEach(async () => {
    process.env.SETUP_TOKEN = TEST_SETUP_TOKEN;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";

    // Clean any pre-existing superadmins
    const superadmins = await db.platformUser.findMany({
      where: { platformRole: "SUPERADMIN" },
      select: { id: true },
    });
    createdUserIds = superadmins.map((u) => u.id);
    if (createdUserIds.length > 0) {
      await db.learningCenter.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await db.userSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
      await db.platformExpense.deleteMany({ where: { createdBy: { in: createdUserIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    if (createdUserIds.length > 0) {
      await db.learningCenter.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await db.userSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
      await db.platformExpense.deleteMany({ where: { createdBy: { in: createdUserIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("Attack 1: GET without SETUP_TOKEN returns 404 (does NOT disclose canInitialize)", async () => {
    const req = mockRequest("/api/platform/first-owner", "GET");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("Attack 2: POST without SETUP_TOKEN returns 404 and does NOT create superadmin", async () => {
    const req = mockRequest("/api/platform/first-owner", "POST", {
      email: `attacker-${Date.now()}@test.com`,
      password: "Password123!",
      fullName: "Attacker Takeover",
    });
    const res = await POST(req);
    expect(res.status).toBe(404);

    const userCount = await db.platformUser.count({ where: { platformRole: "SUPERADMIN" } });
    expect(userCount).toBe(0);
  });

  it("Attack 3: POST with invalid/tampered SETUP_TOKEN returns 404", async () => {
    const req = mockRequest(
      "/api/platform/first-owner",
      "POST",
      {
        email: `attacker2-${Date.now()}@test.com`,
        password: "Password123!",
        fullName: "Attacker With Fake Token",
      },
      { "x-setup-token": "invalid-guessed-token" }
    );
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("Attack 4: Timing attack defense — timingSafeEqual with SHA-256 digests does not throw RangeError on unequal lengths", () => {
    process.env.SETUP_TOKEN = "1234567890123456";
    // Differing byte lengths would throw RangeError with raw crypto.timingSafeEqual
    expect(() => verifySetupTokenValue("1")).not.toThrow();
    expect(verifySetupTokenValue("1")).toBe(false);
    expect(() => verifySetupTokenValue("1234567890123456789012345678901234567890")).not.toThrow();
    expect(verifySetupTokenValue("1234567890123456789012345678901234567890")).toBe(false);
    expect(verifySetupTokenValue("1234567890123456")).toBe(true);
  });

  it("Attack 5: Once SUPERADMIN exists, both GET and POST return 404 even with valid SETUP_TOKEN", async () => {
    // Legitimate first creation
    const legitReq = mockRequest(
      "/api/platform/first-owner",
      "POST",
      {
        email: `first-owner-${Date.now()}@test.com`,
        password: "ValidPassword123!",
        fullName: "First Legitimate Owner",
      },
      { "x-setup-token": TEST_SETUP_TOKEN }
    );
    const firstRes = await POST(legitReq);
    expect(firstRes.status).toBe(201);
    const firstBody = await firstRes.json();
    createdUserIds.push(firstBody.user.id);

    // Subsequent GET with valid token must return 404
    const getReq = mockRequest("/api/platform/first-owner", "GET", undefined, {
      "x-setup-token": TEST_SETUP_TOKEN,
    });
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(404);

    // Subsequent POST with valid token must return 404 (not 403)
    const secondPostReq = mockRequest(
      "/api/platform/first-owner",
      "POST",
      {
        email: `second-attacker-${Date.now()}@test.com`,
        password: "ValidPassword123!",
        fullName: "Second Attacker",
      },
      { "x-setup-token": TEST_SETUP_TOKEN }
    );
    const secondRes = await POST(secondPostReq);
    expect(secondRes.status).toBe(404);
  });

  it("Attack 6: Production fail-closed — missing SETUP_TOKEN disables endpoint completely (404)", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.SETUP_TOKEN;

    const req = mockRequest(
      "/api/platform/first-owner",
      "POST",
      {
        email: `prod-takeover-${Date.now()}@test.com`,
        password: "Password123!",
        fullName: "Prod Takeover",
      },
      { "x-setup-token": "any-token" }
    );
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

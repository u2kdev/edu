import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/platform/first-owner/route";
import { createRequest, invokeRoute } from "../helpers/e2e-client";
import { assertNoForbiddenKeys } from "../helpers/recursive-key-scanner";

const TEST_SETUP_TOKEN = "tier3-cross-feature-secure-setup-token-2026";

describe("Tier 3 Cross-Feature: Setup Token & Proxy IP Spoofing (R2 + R8)", () => {
  const originalEnv = { ...process.env };
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    await db.rateLimitRecord.deleteMany();
    process.env.SETUP_TOKEN = TEST_SETUP_TOKEN;
    process.env.TRUSTED_PROXY_HOPS = "1";

    // Clean existing superadmins to ensure cold platform state
    const superadmins = await db.platformUser.findMany({
      where: { platformRole: "SUPERADMIN" },
      select: { id: true },
    });
    const ids = superadmins.map((u) => u.id);
    if (ids.length > 0) {
      await db.learningCenter.deleteMany({ where: { ownerId: { in: ids } } });
      await db.platformAnnouncementRead.deleteMany({ where: { userId: { in: ids } } });
      await db.platformAnnouncement.deleteMany({ where: { createdBy: { in: ids } } });
      await db.userSession.deleteMany({ where: { userId: { in: ids } } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
      await db.platformExpense.deleteMany({ where: { createdBy: { in: ids } } });
      await db.platformUser.deleteMany({ where: { id: { in: ids } } });
    }
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await db.learningCenter.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await db.platformAnnouncementRead.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.platformAnnouncement.deleteMany({ where: { createdBy: { in: createdUserIds } } });
      await db.userSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
      await db.platformExpense.deleteMany({ where: { createdBy: { in: createdUserIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    await db.rateLimitRecord.deleteMany();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  /**
   * TC-T3-SPOOF-01: Spoofing client IP via forged X-Forwarded-For cannot bypass setup token requirement
   */
  it("TC-T3-SPOOF-01: Spoofed X-Forwarded-For headers cannot bypass SETUP_TOKEN check (fails 404)", async () => {
    const spoofedIps = [
      "127.0.0.1, 10.0.0.1",
      "192.168.1.1, 172.16.0.1",
      "::1, 198.51.100.22",
    ];

    for (const spoofHeader of spoofedIps) {
      // GET without token
      const getRes = await invokeRoute(GET, "/api/platform/first-owner", {
        method: "GET",
        headers: { "x-forwarded-for": spoofHeader },
      });
      expect(getRes.status).toBe(404);

      // POST without token
      const postRes = await invokeRoute(POST, "/api/platform/first-owner", {
        method: "POST",
        headers: { "x-forwarded-for": spoofHeader },
        body: {
          email: "attacker@spoofed.net",
          password: "MaliciousPassword123!",
          fullName: "Spoof Attacker",
        },
      });
      expect(postRes.status).toBe(404);
    }
  });

  /**
   * TC-T3-SPOOF-02: Attacker rotating fake leftmost IPs behind trusted proxy cannot evade rate limiting
   */
  it("TC-T3-SPOOF-02: Mutating leftmost IP in XFF does not evade rate limiting on /api/platform/first-owner", async () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const realProxyHop = "203.0.113.88";

    // Rate limit for POST /api/platform/first-owner is 5 attempts per window
    const attempts = 7;
    const statuses: number[] = [];

    for (let i = 1; i <= attempts; i++) {
      const spoofedLeftIp = `10.99.${i}.${i}`;
      const xff = `${spoofedLeftIp}, ${realProxyHop}`;

      const res = await invokeRoute(POST, "/api/platform/first-owner", {
        method: "POST",
        headers: {
          "x-setup-token": "wrong-token-attempt",
          "x-forwarded-for": xff,
        },
        body: {
          email: `spoof-victim-${i}@test.uz`,
          password: "SomePassword123!",
          fullName: `Attacker ${i}`,
        },
      });

      statuses.push(res.status);
    }

    // First 5 attempts fail with 404 (invalid token), attempts 6+ hit 429 Too Many Requests
    expect(statuses.slice(0, 5).every((s) => s === 404)).toBe(true);
    expect(statuses.slice(5).every((s) => s === 429)).toBe(true);

    // Verify rate limit record in DB is keyed by the rightmost resolved IP
    const rateLimitRec = await db.rateLimitRecord.findFirst({
      where: { key: { contains: realProxyHop } },
    });
    expect(rateLimitRec).not.toBeNull();
    expect(rateLimitRec?.key).toContain(`first-owner:${realProxyHop}`);
  });

  /**
   * TC-T3-SPOOF-03: Legitimate client on distinct proxy IP is not affected by attacker's rate limit
   */
  it("TC-T3-SPOOF-03: Distinct proxy IP remains unblocked when attacker IP is rate-limited", async () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const attackerHop = "198.51.100.99";
    const legitHop = "198.51.100.100";

    // Exhaust attacker quota
    for (let i = 0; i < 5; i++) {
      await invokeRoute(POST, "/api/platform/first-owner", {
        method: "POST",
        headers: {
          "x-setup-token": "bad-token",
          "x-forwarded-for": `1.1.1.${i}, ${attackerHop}`,
        },
        body: { email: `bad-${i}@test.uz`, password: "password", fullName: "bad" },
      });
    }

    // Attacker is now rate-limited
    const attackerRes = await invokeRoute(POST, "/api/platform/first-owner", {
      method: "POST",
      headers: {
        "x-setup-token": "bad-token",
        "x-forwarded-for": `1.1.1.99, ${attackerHop}`,
      },
      body: { email: "bad-extra@test.uz", password: "password", fullName: "bad" },
    });
    expect(attackerRes.status).toBe(429);

    // Legitimate user on distinct hop can proceed with valid token
    const legitRes = await invokeRoute<{
      success: boolean;
      user: { id: string; email: string; platformRole: string };
    }>(POST, "/api/platform/first-owner", {
      method: "POST",
      headers: {
        "x-setup-token": TEST_SETUP_TOKEN,
        "x-forwarded-for": `192.168.1.50, ${legitHop}`,
      },
      body: {
        email: "legit-founder@platform.uz",
        password: "LegitFounderPass2026!",
        fullName: "Platform Founder",
      },
    });

    expect(legitRes.status).toBe(201);
    expect(legitRes.data.success).toBe(true);
    expect(legitRes.data.user.platformRole).toBe("SUPERADMIN");
    createdUserIds.push(legitRes.data.user.id);
  });

  /**
   * TC-T3-SPOOF-04: Successful setup under proxy hop attributes correctly and leaks zero secrets
   */
  it("TC-T3-SPOOF-04: Setup under proxy hops validates response hygiene and AuditLog integrity", async () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const clientHop = "203.0.113.111";
    const edgeHop = "10.0.0.2"; // second hop from right is 203.0.113.111

    const res = await invokeRoute<{
      success: boolean;
      user: { id: string; email: string; fullName: string; platformRole: string };
    }>(POST, "/api/platform/first-owner", {
      method: "POST",
      headers: {
        "x-setup-token": TEST_SETUP_TOKEN,
        "x-forwarded-for": `172.16.0.5, ${clientHop}, ${edgeHop}`,
      },
      body: {
        email: "audit-test-owner@platform.uz",
        password: "ValidSecurePassword2026!",
        fullName: "Audit Owner",
      },
    });

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
    createdUserIds.push(res.data.user.id);

    // R7: Assert zero secret leakage in response
    assertNoForbiddenKeys(res.data, "TC-T3-SPOOF-04 setup response");

    // AuditLog check
    const audit = await db.auditLog.findFirst({
      where: {
        actorUserId: res.data.user.id,
        action: "PLATFORM_FIRST_OWNER_CREATED",
      },
    });
    expect(audit).not.toBeNull();
    const details = JSON.parse(audit!.detailsJson || "{}");
    expect(details.email).toBe("audit-test-owner@platform.uz");
    expect(details.password).toBeUndefined();
    expect(details.passwordHash).toBeUndefined();
  });

  /**
   * TC-T3-SPOOF-05: Post-setup permanent lockdown returns 404 regardless of proxy headers
   */
  it("TC-T3-SPOOF-05: Returns 404 once initialized even with valid SETUP_TOKEN and varied proxy hops", async () => {
    // 1. Initialize platform first
    const initRes = await invokeRoute<{ user: { id: string } }>(
      POST,
      "/api/platform/first-owner",
      {
        method: "POST",
        headers: { "x-setup-token": TEST_SETUP_TOKEN },
        body: {
          email: "first-founder@platform.uz",
          password: "InitialPassword2026!",
          fullName: "First Founder",
        },
      }
    );
    expect(initRes.status).toBe(201);
    createdUserIds.push(initRes.data.user.id);

    // 2. Subsequent GET with varied proxy hops must be 404
    const getRes = await invokeRoute(GET, "/api/platform/first-owner", {
      method: "GET",
      headers: {
        "x-setup-token": TEST_SETUP_TOKEN,
        "x-forwarded-for": "10.0.0.1, 192.168.0.1, 203.0.113.1",
      },
    });
    expect(getRes.status).toBe(404);

    // 3. Subsequent POST with varied proxy hops must be 404
    const postRes = await invokeRoute(POST, "/api/platform/first-owner", {
      method: "POST",
      headers: {
        "x-setup-token": TEST_SETUP_TOKEN,
        "x-forwarded-for": "127.0.0.1, 10.10.10.10",
      },
      body: {
        email: "second-founder@platform.uz",
        password: "SecondPassword2026!",
        fullName: "Second Founder",
      },
    });
    expect(postRes.status).toBe(404);
  });
});

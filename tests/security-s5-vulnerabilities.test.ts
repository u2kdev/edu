import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { hashPassword, signJWT } from "../src/lib/auth";
import { checkRateLimit, clearRateLimit, clearAllRateLimits, BoundedMemoryRateLimiter } from "../src/lib/rate-limit";
import { POST as loginRoute } from "../src/app/api/auth/login/route";
import { POST as forgotPasswordRoute } from "../src/app/api/auth/password/forgot/route";
import { sendEskizSms } from "../src/lib/notifications";
import { verifyTurnstileToken } from "../src/lib/turnstile";
import { POST as registerRoute } from "../src/app/api/auth/register/route";
import { GET as getDeveloperAuditLogs } from "../src/app/api/developer/audit-logs/route";
import { GET as getPlatformDashboard } from "../src/app/api/platform/dashboard/route";
import { withAdvisoryLock } from "../src/lib/cron-lock";
import { middleware } from "../src/middleware";
import { NextRequest } from "next/server";

describe("Stage S5 Security & DoS Vulnerability Reproduction Test Suite", () => {
  let superadminId: string = "";
  let superadminToken: string = "";
  let victimUserEmail: string = "";
  let victimUserId: string = "";

  beforeAll(async () => {
    // 1. Create a platform superadmin
    const superadmin = await db.platformUser.create({
      data: {
        email: `s5-super-${Date.now()}@test.com`,
        passwordHash: await hashPassword("SuperAdminPass123!"),
        platformRole: "SUPERADMIN",
        fullName: "S5 SuperAdmin",
        isActive: true,
      },
    });
    superadminId = superadmin.id;
    superadminToken = signJWT({
      userId: superadmin.id,
      email: superadmin.email,
      platformRole: superadmin.platformRole,
    });

    // 2. Create victim user
    victimUserEmail = `s5-victim-${Date.now()}@test.com`;
    const victim = await db.platformUser.create({
      data: {
        email: victimUserEmail,
        passwordHash: await hashPassword("VictimPass123!"),
        platformRole: "NONE",
        fullName: "S5 Victim User",
        isActive: true,
      },
    });
    victimUserId = victim.id;
  });

  afterAll(async () => {
    await clearAllRateLimits();
    if (victimUserId) {
      await db.auditLog.deleteMany({ where: { actorUserId: victimUserId } }).catch(() => {});
      await db.passwordResetToken.deleteMany({ where: { userId: victimUserId } }).catch(() => {});
      await db.platformUser.deleteMany({ where: { id: victimUserId } }).catch(() => {});
    }
    if (superadminId) {
      await db.auditLog.deleteMany({ where: { actorUserId: superadminId } }).catch(() => {});
      await db.platformUser.deleteMany({ where: { id: superadminId } }).catch(() => {});
    }
  });

  // =========================================================================
  // S5.1: In-memory sliding window pre-check prevents DB DoS on high-frequency spam
  // =========================================================================
  it("S5.1: High-frequency rapid requests hit in-memory pre-check without DB queries", async () => {
    const key = `spam_test_${Date.now()}`;
    // First 3 consume allowed attempts (limit: 3)
    for (let i = 0; i < 3; i++) {
      const allowed = await checkRateLimit(key, 3, 60000, true);
      expect(allowed).toBe(true);
    }

    // 4th attempt should be blocked
    const fourth = await checkRateLimit(key, 3, 60000, true);
    expect(fourth).toBe(false);

    // Spy on DB: subsequent blocked attempts must NOT query db.rateLimitRecord.findUnique or update
    const findUniqueSpy = vi.spyOn(db.rateLimitRecord, "findUnique");
    const updateSpy = vi.spyOn(db.rateLimitRecord, "update");

    // Rapid spam: 10 more calls
    for (let i = 0; i < 10; i++) {
      const blocked = await checkRateLimit(key, 3, 60000, true);
      expect(blocked).toBe(false);
    }

    // Must have short-circuited in memory: 0 DB calls during rapid blocked barrage
    expect(findUniqueSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();

    findUniqueSpy.mockRestore();
    updateSpy.mockRestore();
  });

  // =========================================================================
  // S5.2: Account-scoped rate limiting prevents distributed IP password spraying
  // =========================================================================
  it("S5.2: Rotating IP brute-force attack against single user is blocked by account rate limit", async () => {
    // Attacker sprays 20 wrong password attempts from 20 different IP addresses
    for (let i = 1; i <= 20; i++) {
      const req = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `198.51.100.${i}`,
        },
        body: JSON.stringify({
          login: victimUserEmail,
          password: `WrongPassword${i}!`,
        }),
      });

      const res = await loginRoute(req);
      // Attempts may return 401 invalid credentials (or lockout depending on attempt)
      expect([401, 429]).toContain(res.status);
    }

    // 21st attempt from a brand new IP address (never seen before)
    const req21 = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.99", // Fresh IP
      },
      body: JSON.stringify({
        login: victimUserEmail,
        password: "WrongPassword21!",
      }),
    });

    const res21 = await loginRoute(req21);
    expect(res21.status).toBe(429);
    const json = await res21.json();
    const errorStr = typeof json.error === "object" ? JSON.stringify(json.error) : String(json.error);
    expect(errorStr).toMatch(/rate_limited|too many/i);
  }, 20000);

  // =========================================================================
  // S5.3: Email bombing protection on password reset
  // =========================================================================
  it("S5.3: Repeated password reset requests for a single email are blocked across rotating IPs", async () => {
    const targetEmail = `bombing-target-${Date.now()}@test.com`;
    // Create target user
    const target = await db.platformUser.create({
      data: {
        email: targetEmail,
        passwordHash: await hashPassword("Pass123456!"),
        platformRole: "NONE",
        fullName: "Bombing Target",
        isActive: true,
      },
    });

    try {
      // 5 requests within the hour allowed
      for (let i = 1; i <= 5; i++) {
        const req = new Request("http://localhost/api/auth/password/forgot", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `192.0.2.${i}`,
          },
          body: JSON.stringify({ email: targetEmail }),
        });
        const res = await forgotPasswordRoute(req);
        expect(res.status).toBe(200);
      }

      // 6th request from another new IP must be blocked by recipient rate limit
      const req6 = new Request("http://localhost/api/auth/password/forgot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.0.2.99",
        },
        body: JSON.stringify({ email: targetEmail }),
      });
      const res6 = await forgotPasswordRoute(req6);
      expect(res6.status).toBe(429);
    } finally {
      await db.passwordResetToken.deleteMany({ where: { userId: target.id } });
      await db.auditLog.deleteMany({ where: { actorUserId: target.id } });
      await db.platformUser.deleteMany({ where: { id: target.id } });
    }
  });

  // =========================================================================
  // S5.4: SMS bombing protection per recipient phone
  // =========================================================================
  it("S5.4: Sending SMS repeatedly to same phone number exceeds recipient limit", async () => {
    const phone = "+998901234599";
    // First 5 SMS allowed
    for (let i = 1; i <= 5; i++) {
      const res = await sendEskizSms(phone, `Test message ${i}`);
      expect(res.success).toBe(true);
    }

    // 6th SMS within the hour must be blocked by recipient rate limit
    const res6 = await sendEskizSms(phone, "Test message 6");
    expect(res6.success).toBe(false);
    expect(res6.status).toBe("FAILED");
    expect(res6.error).toMatch(/rate limit|too many/i);
  });

  // =========================================================================
  // S5.5: SMS cost circuit breaker
  // =========================================================================
  it("S5.5: SMS cost circuit breaker halts dispatch when daily threshold is exceeded", async () => {
    // Fill global SMS daily rate limit
    const todayKey = "sms_global_daily:" + new Date().toISOString().slice(0, 10);
    // Artificially trip circuit breaker by setting count to limit
    const limit = 1000;
    await db.rateLimitRecord.upsert({
      where: { key: todayKey },
      create: { key: todayKey, count: limit + 1, expiresAt: new Date(Date.now() + 86400000) },
      update: { count: limit + 1 },
    });

    const res = await sendEskizSms("+998909876543", "Emergency message");
    expect(res.success).toBe(false);
    expect(res.status).toBe("FAILED");
    expect(res.error).toMatch(/circuit breaker|budget/i);

    // Clean up key
    await clearRateLimit(todayKey);
  });

  // =========================================================================
  // S5.6: Turnstile verification on public endpoints
  // =========================================================================
  it("S5.6: Registration and forgot-password reject requests when Turnstile secret is configured but token is missing", async () => {
    const originalSecret = process.env.TURNSTILE_SECRET_KEY;
    process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAAATestKeyForTurnstileSecurityVerification";

    try {
      // 1. Direct helper test
      const verified = await verifyTurnstileToken(undefined, "127.0.0.1");
      expect(verified).toBe(false);

      // 2. Forgot-password endpoint rejects missing turnstile
      const reqForgot = new Request("http://localhost/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "turnstile-test@test.com" }),
      });
      const resForgot = await forgotPasswordRoute(reqForgot);
      expect(resForgot.status).toBe(400);
      const jsonForgot = await resForgot.json();
      const errForgot = typeof jsonForgot.error === "object" ? JSON.stringify(jsonForgot.error) : String(jsonForgot.error);
      expect(errForgot).toMatch(/captcha|turnstile/i);

      // 3. Register endpoint rejects missing turnstile
      const reqReg = new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Turnstile Tester",
          email: "turnstile-reg@test.com",
          password: "SecurePassword123!",
        }),
      });
      const resReg = await registerRoute(reqReg);
      expect(resReg.status).toBe(400);
      const jsonReg = await resReg.json();
      const errReg = typeof jsonReg.error === "object" ? JSON.stringify(jsonReg.error) : String(jsonReg.error);
      expect(errReg).toMatch(/captcha|turnstile/i);
    } finally {
      if (originalSecret !== undefined) {
        process.env.TURNSTILE_SECRET_KEY = originalSecret;
      } else {
        delete process.env.TURNSTILE_SECRET_KEY;
      }
    }
  });

  // =========================================================================
  // S5.7: Query parameter limit clamping
  // =========================================================================
  it("S5.7: Query parameter limit=9999 is clamped to Math.min(100, ...)", async () => {
    const req = new Request("http://localhost/api/developer/audit-logs?limit=9999", {
      headers: { authorization: `Bearer ${superadminToken}` },
    });

    const res = await getDeveloperAuditLogs(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.logs)).toBe(true);
    // Regardless of limit=9999, results returned should never exceed 100
    expect(data.logs.length).toBeLessThanOrEqual(100);
  });

  // =========================================================================
  // S5.8: Dashboard in-memory TTL caching
  // =========================================================================
  it("S5.8: Platform dashboard serves cached response on repeated calls within TTL", async () => {
    const req1 = new Request("http://localhost/api/platform/dashboard?period=30d", {
      headers: { authorization: `Bearer ${superadminToken}` },
    });
    const res1 = await getPlatformDashboard(req1);
    expect(res1.status).toBe(200);

    // Spy on DB aggregate during cached second request
    const aggSpy = vi.spyOn(db.platformPayment, "aggregate");

    const req2 = new Request("http://localhost/api/platform/dashboard?period=30d", {
      headers: { authorization: `Bearer ${superadminToken}` },
    });
    const res2 = await getPlatformDashboard(req2);
    expect(res2.status).toBe(200);

    // Should NOT have hit DB aggregate on second cached call
    expect(aggSpy).not.toHaveBeenCalled();

    // Passing refresh=true bypasses cache and queries DB
    const reqRefresh = new Request("http://localhost/api/platform/dashboard?period=30d&refresh=true", {
      headers: { authorization: `Bearer ${superadminToken}` },
    });
    const resRefresh = await getPlatformDashboard(reqRefresh);
    expect(resRefresh.status).toBe(200);
    expect(aggSpy).toHaveBeenCalled();

    aggSpy.mockRestore();
  });

  // =========================================================================
  // S5.9: Advisory locks prevent concurrent cron job collisions
  // =========================================================================
  it("S5.9: Concurrent cron executions with advisory locks prevent race conditions", async () => {
    const testLockId = 9991;
    let jobRunning = false;
    let jobExecutionCount = 0;

    // Simulate long-running job 1
    const runJob1 = withAdvisoryLock(testLockId, async () => {
      jobRunning = true;
      jobExecutionCount++;
      await new Promise((r) => setTimeout(r, 200));
      jobRunning = false;
      return "JOB1_DONE";
    });

    // Short wait to ensure job 1 has acquired lock
    await new Promise((r) => setTimeout(r, 30));

    // Simulate simultaneous job 2 attempting same lock
    const runJob2 = withAdvisoryLock(testLockId, async () => {
      jobExecutionCount++;
      return "JOB2_DONE";
    });

    const [res1, res2] = await Promise.all([runJob1, runJob2]);

    expect(res1.executed).toBe(true);
    expect(res1.result).toBe("JOB1_DONE");

    // Job 2 was safely skipped/locked out
    expect(res2.executed).toBe(false);
    expect(res2.reason).toBe("LOCKED");
    expect(jobExecutionCount).toBe(1);
  });

  // =========================================================================
  // S5.10: Request body limit blocks oversized payloads in middleware
  // =========================================================================
  it("S5.10: State-changing requests with oversized payload (2MB) are rejected with HTTP 413", () => {
    const oversizedLength = (2 * 1024 * 1024).toString(); // 2MB
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-length": oversizedLength,
        "content-type": "application/json",
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(413);
  });
});

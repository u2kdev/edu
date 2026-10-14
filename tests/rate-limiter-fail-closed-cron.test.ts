import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST as loginPost } from "../src/app/api/auth/login/route";
import { POST as registerPost } from "../src/app/api/auth/register/route";
import { POST as forgotPost } from "../src/app/api/auth/password/forgot/route";
import { POST as resetPost } from "../src/app/api/auth/password/reset/route";
import { POST as cronCleanupPost } from "../src/app/api/cron/cleanup/route";
import { POST as cronEmailOutboxPost } from "../src/app/api/cron/email-outbox/route";
import { db } from "../src/lib/db";
import { checkRateLimit, RateLimiterDatabaseError, cleanupExpiredRateLimits } from "../src/lib/rate-limit";
import { cleanupEmailOutbox } from "../src/lib/email";
import fs from "fs";
import path from "path";

function mockJsonReq(url: string, body: Record<string, unknown>, authHeader?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": "198.51.100.25",
  };
  if (authHeader) {
    headers["authorization"] = authHeader;
  }
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("LAUNCH-1 Item 2: Rate Limiter Fail-Closed & Vercel Cron Maintenance", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("1. Fail-closed on Database Failure (503 Service Unavailable)", () => {
    it("checkRateLimit throws RateLimiterDatabaseError on DB failure (no in-memory fallback)", async () => {
      const dbSpy = vi.spyOn(db.rateLimitRecord, "findUnique").mockRejectedValue(
        new Error("Connection to PostgreSQL pool timed out")
      );

      await expect(checkRateLimit("fail_closed_test_key")).rejects.toThrow(
        RateLimiterDatabaseError
      );

      dbSpy.mockRestore();
    });

    it("POST /api/auth/login returns 503 when rate limiter DB fails", async () => {
      const dbSpy = vi.spyOn(db.rateLimitRecord, "findUnique").mockRejectedValue(
        new Error("Database connection refused")
      );

      const res = await loginPost(
        mockJsonReq("http://localhost:3000/api/auth/login", {
          email: "user@test.com",
          password: "password123",
        })
      );

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("SERVICE_UNAVAILABLE");

      dbSpy.mockRestore();
    });

    it("POST /api/auth/register returns 503 when rate limiter DB fails", async () => {
      const dbSpy = vi.spyOn(db.rateLimitRecord, "findUnique").mockRejectedValue(
        new Error("Database connection refused")
      );

      const res = await registerPost(
        mockJsonReq("http://localhost:3000/api/auth/register", {
          email: "newuser@test.com",
          password: "password123",
          fullName: "New User",
          inviteCode: "INV-123",
        })
      );

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("SERVICE_UNAVAILABLE");

      dbSpy.mockRestore();
    });

    it("POST /api/auth/password/forgot returns 503 when rate limiter DB fails", async () => {
      const dbSpy = vi.spyOn(db.rateLimitRecord, "findUnique").mockRejectedValue(
        new Error("Database connection refused")
      );

      const res = await forgotPost(
        mockJsonReq("http://localhost:3000/api/auth/password/forgot", {
          email: "forgot@test.com",
        })
      );

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("SERVICE_UNAVAILABLE");

      dbSpy.mockRestore();
    });

    it("POST /api/auth/password/reset returns 503 when rate limiter DB fails", async () => {
      const dbSpy = vi.spyOn(db.rateLimitRecord, "findUnique").mockRejectedValue(
        new Error("Database connection refused")
      );

      const res = await resetPost(
        mockJsonReq("http://localhost:3000/api/auth/password/reset", {
          token: "dummy-token-abc",
          newPassword: "password123456",
        })
      );

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("SERVICE_UNAVAILABLE");

      dbSpy.mockRestore();
    });
  });

  describe("2. Scheduled Maintenance & Cron Authentication (/api/cron/*)", () => {
    it("Rejects requests without valid CRON_SECRET with 401", async () => {
      process.env.CRON_SECRET = "production_cron_secret_key_12345";

      // Missing header
      const res1 = await cronCleanupPost(
        mockJsonReq("http://localhost:3000/api/cron/cleanup", {})
      );
      expect(res1.status).toBe(401);

      // Wrong header
      const res2 = await cronEmailOutboxPost(
        mockJsonReq("http://localhost:3000/api/cron/email-outbox", {}, "Bearer wrong_secret")
      );
      expect(res2.status).toBe(401);
    });

    it("Accepts requests with valid CRON_SECRET", async () => {
      process.env.CRON_SECRET = "valid_cron_secret_777";

      const res = await cronCleanupPost(
        mockJsonReq("http://localhost:3000/api/cron/cleanup", {}, "Bearer valid_cron_secret_777")
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json).toHaveProperty("rateLimitsCleaned");
      expect(json).toHaveProperty("emailOutboxCleaned");
    });

    it("cleanupExpiredRateLimits removes expired records but retains active ones", async () => {
      const now = Date.now();
      const expiredKey = `expired_key_${now}`;
      const activeKey = `active_key_${now}`;

      await db.rateLimitRecord.createMany({
        data: [
          { key: expiredKey, count: 5, expiresAt: new Date(now - 10000) },
          { key: activeKey, count: 2, expiresAt: new Date(now + 600000) },
        ],
      });

      const deletedCount = await cleanupExpiredRateLimits();
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      const expiredCheck = await db.rateLimitRecord.findUnique({ where: { key: expiredKey } });
      const activeCheck = await db.rateLimitRecord.findUnique({ where: { key: activeKey } });

      expect(expiredCheck).toBeNull();
      expect(activeCheck).not.toBeNull();
    });

    it("cleanupEmailOutbox purges sent emails older than retention period", async () => {
      const oldSent = await db.emailOutbox.create({
        data: {
          to: "old@test.com",
          subject: "Old",
          body: "Old body",
          status: "SENT",
          sentAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
        },
      });

      const recentSent = await db.emailOutbox.create({
        data: {
          to: "recent@test.com",
          subject: "Recent",
          body: "Recent body",
          status: "SENT",
          sentAt: new Date(),
        },
      });

      const deletedCount = await cleanupEmailOutbox(30);
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      const oldCheck = await db.emailOutbox.findUnique({ where: { id: oldSent.id } });
      const recentCheck = await db.emailOutbox.findUnique({ where: { id: recentSent.id } });

      expect(oldCheck).toBeNull();
      expect(recentCheck).not.toBeNull();
    });

    it("vercel.json configures crons for email-outbox and cleanup", () => {
      const vercelConfigPath = path.resolve(__dirname, "../vercel.json");
      expect(fs.existsSync(vercelConfigPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(vercelConfigPath, "utf-8"));
      expect(config).toHaveProperty("crons");
      expect(Array.isArray(config.crons)).toBe(true);

      const paths = config.crons.map((c: { path: string }) => c.path);
      expect(paths).toContain("/api/cron/email-outbox");
      expect(paths).toContain("/api/cron/cleanup");
    });
  });
});

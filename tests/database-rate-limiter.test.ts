import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../src/lib/db";
import { checkRateLimit, clearRateLimit } from "../src/lib/rate-limit";

describe("Database-Backed Rate Limiter & Multi-Instance Isolation", () => {
  const testKey = "test_ip_multi_instance_1";

  beforeEach(async () => {
    // Clean up test records
    await db.rateLimitRecord.deleteMany({
      where: { key: { startsWith: "test_ip_" } },
    });
  });

  it("TEST 1: Rate limiter persists attempts directly into database table RateLimitRecord", async () => {
    const key = "test_ip_db_persist";
    const allowed1 = await checkRateLimit(key, 5, 60000);
    expect(allowed1).toBe(true);

    const record = await db.rateLimitRecord.findUnique({
      where: { key },
    });

    expect(record).toBeDefined();
    expect(record?.count).toBe(1);
    expect(record?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("TEST 2: Two simulated independent client instances sharing database correctly enforce limit", async () => {
    const key = "test_ip_shared_cluster";
    const max = 5;
    const windowMs = 60000;

    // Instance A makes 3 requests
    for (let i = 0; i < 3; i++) {
      const res = await checkRateLimit(key, max, windowMs);
      expect(res).toBe(true);
    }

    // Instance B (simulating another serverless lambda accessing the same DB)
    // Makes 2 requests -> reaches max 5
    for (let i = 0; i < 2; i++) {
      const res = await checkRateLimit(key, max, windowMs);
      expect(res).toBe(true);
    }

    // 6th request from Instance B MUST be blocked
    const blockedRes = await checkRateLimit(key, max, windowMs);
    expect(blockedRes).toBe(false);

    // Verify DB count
    const dbRecord = await db.rateLimitRecord.findUnique({ where: { key } });
    expect(dbRecord?.count).toBe(5);
  });

  it("TEST 3: Non-consuming check (consume = false) does not increment DB counter", async () => {
    const key = "test_ip_peek_only";
    const max = 3;

    await checkRateLimit(key, max, 60000, true);
    await checkRateLimit(key, max, 60000, true);

    const recordBefore = await db.rateLimitRecord.findUnique({ where: { key } });
    expect(recordBefore?.count).toBe(2);

    // Peek without consuming
    const peekAllowed = await checkRateLimit(key, max, 60000, false);
    expect(peekAllowed).toBe(true);

    const recordAfter = await db.rateLimitRecord.findUnique({ where: { key } });
    expect(recordAfter?.count).toBe(2);
  });

  it("TEST 4: clearRateLimit deletes record from database", async () => {
    const key = "test_ip_clear_test";
    await checkRateLimit(key, 5, 60000, true);

    const recordBefore = await db.rateLimitRecord.findUnique({ where: { key } });
    expect(recordBefore).toBeDefined();

    await clearRateLimit(key);

    const recordAfter = await db.rateLimitRecord.findUnique({ where: { key } });
    expect(recordAfter).toBeNull();
  });
});

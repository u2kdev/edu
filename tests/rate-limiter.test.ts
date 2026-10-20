import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, clearRateLimit } from "../src/lib/rate-limit";
import { db } from "../src/lib/db";

describe("Rate Limiter", () => {
  beforeEach(async () => {
    // Clear any test keys
    await db.rateLimitRecord.deleteMany({
      where: { key: { startsWith: "192.168.1." } },
    });
  });

  it("should allow requests under the limit", async () => {
    const ip = "192.168.1.1";
    for (let i = 0; i < 10; i++) {
      expect(await checkRateLimit(ip)).toBe(true);
    }
  });

  it("should block requests over the limit", async () => {
    const ip = "192.168.1.2";
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(ip);
    }
    // 11th request should be blocked
    expect(await checkRateLimit(ip)).toBe(false);
  });

  it("should reset window after timeout", async () => {
    const ip = "192.168.1.3";
    // 100ms window
    for (let i = 0; i < 2; i++) {
      await checkRateLimit(ip, 2, 80);
    }
    expect(await checkRateLimit(ip, 2, 80)).toBe(false);

    // Wait 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(await checkRateLimit(ip, 2, 80)).toBe(true);
  });

  it("different keys are independent", async () => {
    const ip1 = "192.168.1.4";
    const ip2 = "192.168.1.5";

    for (let i = 0; i < 10; i++) {
      await checkRateLimit(ip1);
    }
    expect(await checkRateLimit(ip1)).toBe(false);
    expect(await checkRateLimit(ip2)).toBe(true);
  });
});

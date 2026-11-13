import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifySetupTokenValue, verifySetupToken } from "../src/lib/setup-token";
import { POST, GET } from "../src/app/api/platform/first-owner/route";
import { db } from "../src/lib/db";
import crypto from "crypto";

const TEST_SETUP_TOKEN = "super-secret-setup-token-min-16-chars-2026";

describe("Milestone 1 / R2 Empirical Adversarial Stress & Timing Test Suite", () => {
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
      await db.platformUser.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    if (createdUserIds.length > 0) {
      await db.learningCenter.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await db.userSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  // =========================================================================
  // 1. TIMING ATTACK SIMULATION & LENGTH ORACLE ELIMINATION
  // =========================================================================
  describe("Timing Attack Simulation & Length Oracle Stress Test", () => {
    const SECRET = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"; // 32 characters

    it("1.1 Immunity to RangeError on unequal lengths, non-ASCII, and edge cases", () => {
      process.env.SETUP_TOKEN = SECRET;

      const testCases = [
        "",
        " ",
        "   ",
        "\t\r\n",
        "1",
        "a",
        "a".repeat(15),
        "a".repeat(16),
        "a".repeat(31),
        "a".repeat(32),
        "a".repeat(33),
        "a".repeat(64),
        "a".repeat(128),
        "a".repeat(512),
        "a".repeat(1024),
        "a".repeat(4096),
        "ПриветМир12345",
        "🔒🔑🛡️✨🎉🔥",
        "こんにちは世界",
        "مرحبا بالعالم",
        "1234\x005678",
        "!@#$%^&*()_+-=[]{}|;':\",.<>?/~`",
        null as unknown as string,
        undefined as unknown as string,
      ];

      for (const input of testCases) {
        expect(() => verifySetupTokenValue(input)).not.toThrow();
        // None of these should match the secret
        expect(verifySetupTokenValue(input)).toBe(false);
      }

      // Valid match must return true
      expect(verifySetupTokenValue(SECRET)).toBe(true);
      // Valid match with whitespace trimmed must return true
      expect(verifySetupTokenValue(`  ${SECRET}  `)).toBe(true);
    });

    it("1.2 10,000 Iteration Timing Distribution Benchmark across length and character classes", () => {
      process.env.SETUP_TOKEN = SECRET;

      const testClasses: Record<string, string> = {
        "exact_match": SECRET,
        "mismatch_len_1": "x",
        "mismatch_len_15": "x".repeat(15),
        "mismatch_len_16": "x".repeat(16),
        "mismatch_len_32_first_byte": "z" + SECRET.slice(1),
        "mismatch_len_32_last_byte": SECRET.slice(0, 31) + "z",
        "mismatch_len_64": "y".repeat(64),
        "mismatch_len_512": "w".repeat(512),
        "mismatch_len_4096": "v".repeat(4096),
        "mismatch_unicode_astral": "🔒🔑🛡️✨🎉🔥".repeat(10),
        "mismatch_special_chars": "!@#$%^&*()_+-=[]{}|;':\",.<>?/~`".repeat(5),
      };

      const ITERATIONS_PER_CLASS = 10000;
      const timingResults: Record<string, {
        meanNs: number;
        medianNs: number;
        stdDevNs: number;
        minNs: number;
        maxNs: number;
        p95Ns: number;
        p99Ns: number;
        noRangeErrors: boolean;
      }> = {};

      // Warmup JIT
      for (let i = 0; i < 1000; i++) {
        verifySetupTokenValue("warmup-token-value-12345678");
      }

      for (const [className, tokenValue] of Object.entries(testClasses)) {
        const timings: number[] = new Array(ITERATIONS_PER_CLASS);
        let errorCount = 0;

        for (let i = 0; i < ITERATIONS_PER_CLASS; i++) {
          const t0 = process.hrtime.bigint();
          try {
            verifySetupTokenValue(tokenValue);
          } catch {
            errorCount++;
          }
          const t1 = process.hrtime.bigint();
          timings[i] = Number(t1 - t0);
        }

        timings.sort((a, b) => a - b);
        const sum = timings.reduce((acc, val) => acc + val, 0);
        const mean = sum / ITERATIONS_PER_CLASS;
        const median = timings[Math.floor(ITERATIONS_PER_CLASS / 2)];
        const min = timings[0];
        const max = timings[ITERATIONS_PER_CLASS - 1];
        const p95 = timings[Math.floor(ITERATIONS_PER_CLASS * 0.95)];
        const p99 = timings[Math.floor(ITERATIONS_PER_CLASS * 0.99)];
        const variance = timings.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / ITERATIONS_PER_CLASS;
        const stdDev = Math.sqrt(variance);

        timingResults[className] = {
          meanNs: Math.round(mean),
          medianNs: Math.round(median),
          stdDevNs: Math.round(stdDev),
          minNs: min,
          maxNs: max,
          p95Ns: p95,
          p99Ns: p99,
          noRangeErrors: errorCount === 0,
        };

        expect(errorCount).toBe(0);
      }

      console.log("Timing Distribution Benchmark Results (10,000 iterations each):");
      console.table(timingResults);

      // Verify constant-time comparison on 32-byte digests:
      // Comparing first-byte mismatch vs last-byte mismatch should show near-identical median execution time
      const firstByteMedian = timingResults["mismatch_len_32_first_byte"].medianNs;
      const lastByteMedian = timingResults["mismatch_len_32_last_byte"].medianNs;
      const exactMatchMedian = timingResults["exact_match"].medianNs;

      // Ratio between first-byte mismatch and last-byte mismatch must be close to 1.0 (no short-circuit oracle)
      const ratio = firstByteMedian / lastByteMedian;
      expect(ratio).toBeGreaterThan(0.7);
      expect(ratio).toBeLessThan(1.4);

      // Verify no RangeErrors in any class
      for (const res of Object.values(timingResults)) {
        expect(res.noRangeErrors).toBe(true);
      }
    });

    it("1.3 Production fail-closed when SETUP_TOKEN is missing or under 16 characters", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // 1. Unset
      delete process.env.SETUP_TOKEN;
      expect(verifySetupTokenValue("any-token-even-very-long")).toBe(false);

      // 2. Empty string
      process.env.SETUP_TOKEN = "";
      expect(verifySetupTokenValue("any-token-even-very-long")).toBe(false);

      // 3. 15 characters (< 16 min)
      process.env.SETUP_TOKEN = "123456789012345";
      expect(verifySetupTokenValue("123456789012345")).toBe(false);

      // 4. 16 characters (meets requirement)
      process.env.SETUP_TOKEN = "1234567890123456";
      expect(verifySetupTokenValue("1234567890123456")).toBe(true);
    });
  });

  // =========================================================================
  // 2. CONCURRENCY & RACE CONDITION TEST (20 Concurrent Requests)
  // =========================================================================
  describe("Concurrency & Race Condition Attack on First-Owner Setup", () => {
    it("2.1 Simulates 20 concurrent POST /api/platform/first-owner requests on empty DB", async () => {
      const CONCURRENCY = 20;

      // Ensure database is truly empty of superadmins
      const initialCount = await db.platformUser.count({
        where: { platformRole: "SUPERADMIN" },
      });
      expect(initialCount).toBe(0);

      // Create 20 concurrent requests with distinct client IPs so rate limiting does not mask race condition
      const requests = Array.from({ length: CONCURRENCY }, (_, i) => {
        const req = new Request("http://localhost/api/platform/first-owner", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `198.51.100.${i + 1}`,
            "x-setup-token": TEST_SETUP_TOKEN,
          },
          body: JSON.stringify({
            email: `concurrent-racer-${i}-${Date.now()}@platform.uz`,
            password: `RacePassword123!_${i}`,
            fullName: `Concurrent SuperAdmin ${i}`,
          }),
        });
        return POST(req);
      });

      // Fire all 20 requests concurrently via Promise.all
      const responses = await Promise.all(requests);

      const statuses = responses.map((r) => r.status);
      const bodies = await Promise.all(responses.map((r) => r.json()));

      console.log("Concurrent 20 POST Statuses:", statuses);

      const statusCounts: Record<number, number> = {};
      for (const s of statuses) {
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }
      console.log("Status distribution:", statusCounts);

      // Exactly ONE request must succeed with 201 Created
      const count201 = statusCounts[201] || 0;
      // All other concurrent requests must be rejected with 404 Not Found
      const count404 = statusCounts[404] || 0;
      // No internal server errors (500)
      const count500 = statusCounts[500] || 0;

      // Track created user for cleanup
      const createdSuperadmins = await db.platformUser.findMany({
        where: { platformRole: "SUPERADMIN" },
      });
      for (const u of createdSuperadmins) {
        createdUserIds.push(u.id);
      }

      console.log(`Created Superadmins in DB: ${createdSuperadmins.length}`);

      expect(count500).toBe(0);
      expect(count201).toBe(1);
      expect(count404).toBe(CONCURRENCY - 1);
      expect(createdSuperadmins.length).toBe(1);

      // Verify AuditLog has exactly 1 entry for first owner creation
      const auditCount = await db.auditLog.count({
        where: { action: "PLATFORM_FIRST_OWNER_CREATED" },
      });
      expect(auditCount).toBe(1);
    });

    it("2.2 Simulates 20 concurrent POST requests with IDENTICAL email payload", async () => {
      const CONCURRENCY = 20;
      const sharedEmail = `same-email-racer-${Date.now()}@platform.uz`;

      const requests = Array.from({ length: CONCURRENCY }, (_, i) => {
        const req = new Request("http://localhost/api/platform/first-owner", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `198.51.200.${i + 1}`,
            "x-setup-token": TEST_SETUP_TOKEN,
          },
          body: JSON.stringify({
            email: sharedEmail,
            password: `RacePassword123!_${i}`,
            fullName: `Shared SuperAdmin ${i}`,
          }),
        });
        return POST(req);
      });

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      const statusCounts: Record<number, number> = {};
      for (const s of statuses) {
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }
      console.log("Identical Email - Status distribution:", statusCounts);

      const createdSuperadmins = await db.platformUser.findMany({
        where: { platformRole: "SUPERADMIN" },
      });
      for (const u of createdSuperadmins) {
        createdUserIds.push(u.id);
      }

      expect(statusCounts[500] || 0).toBe(0);
      expect(statusCounts[201]).toBe(1);
      expect(statusCounts[404]).toBe(CONCURRENCY - 1);
      expect(createdSuperadmins.length).toBe(1);
    });
  });
});

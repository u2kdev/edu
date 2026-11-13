import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getClientIp, getClientFingerprint } from "../src/lib/ip";
import { checkRateLimit, BoundedMemoryRateLimiter } from "../src/lib/rate-limit";
import { db } from "../src/lib/db";

describe("TDD Attack Suite: R8 Client IP Resolution, Anti-DoS & Fallback Fingerprinting", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.TRUSTED_PROXY_HOPS;
    delete process.env.TRUST_PROXY_HEADERS;
    await db.rateLimitRecord.deleteMany({
      where: { key: { contains: "fp_" } },
    });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await db.rateLimitRecord.deleteMany({
      where: { key: { contains: "fp_" } },
    });
  });

  // ATTACK 1: Shared "unknown" Lockout DoS
  it("Attack 1 [FAIL on baseline]: Unresolvable clients receive distinct fingerprint keys and do NOT trigger shared rate-limiting lockouts", async () => {
    const attackerReq = new Request("http://localhost/api/test", {
      headers: { "user-agent": "AttackerBot/1.0" },
    });
    const benignReq = new Request("http://localhost/api/test", {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0" },
    });

    const attackerKey = getClientIp(attackerReq);
    const benignKey = getClientIp(benignReq);

    // 1. Must NOT return identical "unknown"
    expect(attackerKey).not.toBe("unknown");
    expect(benignKey).not.toBe("unknown");
    expect(attackerKey).not.toBe(benignKey);
    expect(attackerKey).toMatch(/^fp_[0-9a-f]{16}$/);
    expect(benignKey).toMatch(/^fp_[0-9a-f]{16}$/);

    // 2. Simulate attacker exhausting limit (5 requests)
    for (let i = 0; i < 5; i++) {
      const allowed = await checkRateLimit(`test_endpoint:${attackerKey}`, 5, 60000);
      expect(allowed).toBe(true);
    }
    // 6th attacker request blocked
    const attackerBlocked = await checkRateLimit(`test_endpoint:${attackerKey}`, 5, 60000);
    expect(attackerBlocked).toBe(false);

    // 3. Benign user MUST NOT be blocked!
    const benignAllowed = await checkRateLimit(`test_endpoint:${benignKey}`, 5, 60000);
    expect(benignAllowed).toBe(true);
  });

  // ATTACK 2: Leftmost IP Spoofing on Short Chains
  it("Attack 2 [FAIL on baseline]: When proxy chain is shorter than TRUSTED_PROXY_HOPS, leftmost IP is rejected", () => {
    process.env.TRUSTED_PROXY_HOPS = "2"; // Expects at least 2 proxy hops

    // Attacker sends single spoofed IP
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "198.51.100.99" },
    });

    const resolved = getClientIp(req);
    // Baseline code returns "198.51.100.99" (VULNERABLE!)
    // Secure code rejects it and falls back to fingerprint
    expect(resolved).not.toBe("198.51.100.99");
    expect(resolved).toMatch(/^fp_/);
  });

  // ATTACK 3: Malformed / Injection IP Formats
  it("Attack 3 [FAIL on baseline]: Malformed or malicious strings in proxy headers are rejected by net.isIP", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";

    const badInputs = [
      "<script>alert(1)</script>",
      "999.999.999.999",
      "1.2.3.4.5",
      "not-an-ip",
      "../../etc/passwd",
    ];

    for (const bad of badInputs) {
      const req = new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": bad },
      });

      const resolved = getClientIp(req);
      expect(resolved).not.toContain("<script>");
      expect(resolved).not.toBe(bad);
      expect(resolved).toMatch(/^fp_/);
    }
  });

  // ATTACK 4: Strict Rightmost Extraction with Valid IP & Port Stripping
  it("Attack 4 [FAIL on baseline for ports]: Extracts legitimate rightmost IP according to TRUSTED_PROXY_HOPS and strips ports", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";

    // Clean IP without port
    const req1 = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.195, 198.51.100.10" },
    });
    expect(getClientIp(req1)).toBe("198.51.100.10");

    // IPv4 with port: 198.51.100.1:5678 -> 198.51.100.1
    const req2 = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "198.51.100.1:5678" },
    });
    expect(getClientIp(req2)).toBe("198.51.100.1");

    // IPv6 with port and brackets: [2001:db8::1]:8080 -> 2001:db8::1
    const req3 = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "[2001:db8::1]:8080" },
    });
    expect(getClientIp(req3)).toBe("2001:db8::1");
  });

  // ATTACK 5: Memory Leak Bounded Capacity & LRU Eviction
  it("Attack 5: BoundedMemoryRateLimiter caps memory size and evicts oldest entries under flood", () => {
    const maxEntries = 100;
    const limiter = new BoundedMemoryRateLimiter(maxEntries);

    // Flood with 500 distinct keys
    for (let i = 0; i < 500; i++) {
      limiter.check(`key_${i}`, 5, 60000, true);
    }

    // Size must never exceed maxEntries
    expect(limiter.size()).toBe(maxEntries);

    // Most recent keys (e.g. key_499) must be retained
    expect(limiter.check("key_499", 5, 60000, false)).toBe(true);
  });
});

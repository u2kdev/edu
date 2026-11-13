import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { normalizeIpCandidate, getClientIp, getClientFingerprint } from "../src/lib/ip";
import { BoundedMemoryRateLimiter, getClientRateLimitKey } from "../src/lib/rate-limit";
import net from "net";

interface RateLimiterInternals {
  store: Map<string, { count: number; expiresAt: number }>;
}

describe("Milestone 1 / R8 Empirical Adversarial Stress Test Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // =========================================================================
  // 1. ADVERSARIAL IP FUZZING & NORMALIZATION STRESS TESTS
  // =========================================================================
  describe("Adversarial IP Fuzzing & Normalization", () => {
    const maliciousFuzzInputs = [
      // XSS & Script Injection
      "<script>alert(1)</script>",
      "\"><script src='http://evil.com/xss.js'></script>",
      "<img src=x onerror=alert('xss')>",
      "javascript:alert(1)",
      // SQL Injection
      "198.51.100.1' OR '1'='1",
      "198.51.100.1'; DROP TABLE platform_users; --",
      "1' UNION SELECT * FROM rate_limits --",
      // Path Traversal & OS Commands
      "../../../../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\cmd.exe",
      "127.0.0.1 && cat /etc/shadow",
      "127.0.0.1; id",
      // CRLF & Header Injection
      "198.51.100.1\r\nX-Injected-Header: evil",
      "198.51.100.1\nSet-Cookie: session=hijacked",
      // Null Bytes & Format Strings
      "198.51.100.1\x00extra",
      "%00198.51.100.1",
      "%s%s%s%s%s%s%s",
      "%x%x%x%x",
      // BIDI Overrides & Unicode Spoofing
      "\u202E1.0.0.198",
      "\uFEFF198.51.100.1",
      "１９8.５1.１00.1", // Full-width numbers
      "198。51。100。1", // Ideographic full stop
      // Malformed IPv4 Octets
      "999.999.999.999",
      "256.1.1.1",
      "1.256.1.1",
      "1.1.256.1",
      "1.1.1.256",
      "-1.0.0.1",
      "1.2.3.4.5",
      "1.2.3",
      "1.2",
      "1",
      "01.02.03.04", // Leading zero ambiguity
      "1.2.3.4/24",  // CIDR notation
      // Malformed IPv6
      "2001:db8:::1",
      "2001:db8:g::1",
      ":::1",
      "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", // 9 hex pieces
      ":",
      "::",
      // Malformed Port Patterns
      "198.51.100.1:port",
      "198.51.100.1:-80",
      "198.51.100.1:65536",
      "198.51.100.1:99999",
      "198.51.100.1:0",
      "[2001:db8::1]:port",
      "[2001:db8::1]:-1",
      "[2001:db8::1]:65536",
      "[2001:db8::1]:99999",
      "[2001:db8::1]:0",
      // Empty, Whitespace, & Delimiter Bombs
      "",
      "   ",
      "\t\n\r",
      ",,,,,",
      ", , , , ,",
      "\"\"",
      "''",
      "\" \"",
    ];

    it("Fuzz normalizeIpCandidate: never returns malicious payload, only valid IP or null", () => {
      for (const input of maliciousFuzzInputs) {
        const result = normalizeIpCandidate(input);
        if (result !== null) {
          // If a result is returned, it MUST be a strictly valid IP (version 4 or 6)
          const version = net.isIP(result);
          expect(version, `Failed on input: ${input} -> normalized: ${result}`).toBeGreaterThan(0);
          // And must never contain script tags, quotes, or control characters
          expect(result).not.toMatch(/[<>"'`;\s\r\n\x00]/);
        }
      }
    });

    it("Fuzz getClientIp: under hostile X-Forwarded-For headers, fails closed safely to fingerprint", () => {
      process.env.TRUSTED_PROXY_HOPS = "1";

      for (const input of maliciousFuzzInputs) {
        let req: Request;
        try {
          req = new Request("http://localhost/api/test", {
            headers: {
              "x-forwarded-for": input,
              "user-agent": "FuzzBot/1.0",
            },
          });
        } catch {
          // If native HTTP parser rejects CRLF/illegal characters in header,
          // mock request to verify getClientIp defense-in-depth even if bypassed
          const headerMap = new Map<string, string>([
            ["x-forwarded-for", input],
            ["user-agent", "FuzzBot/1.0"],
          ]);
          req = {
            headers: {
              get: (headerName: string) => headerMap.get(headerName.toLowerCase()) || null,
            },
          } as unknown as Request;
        }

        const ip = getClientIp(req);
        // Result must either be a valid normalized IP or a secure fingerprint (never raw malicious string)
        const isIp = net.isIP(ip) !== 0;
        const isFp = /^fp_[0-9a-f]{16}$/.test(ip);
        expect(
          isIp || isFp,
          `getClientIp returned unsafe value: "${ip}" for hostile input: "${input}"`
        ).toBe(true);
        expect(ip).not.toContain("<script>");
        expect(ip).not.toContain("DROP TABLE");
        expect(ip).not.toContain("../");
      }
    });

    it("IPv4-mapped IPv6 handling: verifies normalization and fail-closed safety", () => {
      // Unbracketed IPv4-mapped IPv6
      const ipv4Mapped = "::ffff:192.0.2.128";
      const normalized = normalizeIpCandidate(ipv4Mapped);
      expect(normalized).toBe("::ffff:192.0.2.128");
      expect(net.isIP(normalized!)).toBe(6);

      // Bracketed IPv4-mapped IPv6: [::ffff:192.0.2.128]
      // Notice: candidate regex may either extract valid IPv6 or safely return null (fail closed)
      const bracketedMapped = "[::ffff:192.0.2.128]";
      const normalizedBracketed = normalizeIpCandidate(bracketedMapped);
      if (normalizedBracketed !== null) {
        expect(net.isIP(normalizedBracketed)).toBe(6);
      } else {
        // Safe fail-closed: getClientIp falls back to fingerprint
        const req = new Request("http://localhost/api/test", {
          headers: { "x-forwarded-for": bracketedMapped },
        });
        process.env.TRUSTED_PROXY_HOPS = "1";
        expect(getClientIp(req)).toMatch(/^fp_[0-9a-f]{16}$/);
      }
    });

    it("Handles multiple commas, irregular whitespace, and quoted IP candidates", () => {
      process.env.TRUSTED_PROXY_HOPS = "1";

      const validVariants = [
        "   198.51.100.5   ",
        "\"198.51.100.5\"",
        "'198.51.100.5'",
        ",,, 198.51.100.5 ,,,",
        "203.0.113.1, , , 198.51.100.5",
        "\"198.51.100.5:8080\"",
      ];

      for (const variant of validVariants) {
        const req = new Request("http://localhost/api/test", {
          headers: { "x-forwarded-for": variant },
        });
        const ip = getClientIp(req);
        expect(ip, `Failed on variant: ${variant}`).toBe("198.51.100.5");
      }
    });

    it("Extreme hop values (0, negative, oversized, NaN): always fail-closed safely to fingerprint or valid hop", () => {
      const extremeHops = ["0", "-1", "-99999", "100", "1000000", "NaN", "undefined", "Infinity", "invalid"];
      const req = new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": "198.51.100.1, 198.51.100.2" },
      });

      for (const hopVal of extremeHops) {
        process.env.TRUSTED_PROXY_HOPS = hopVal;
        const ip = getClientIp(req);
        // None of these should crash or return spoofed parts[0] when hops > chain length or hops <= 0
        expect(ip).toMatch(/^(fp_[0-9a-f]{16}|198\.51\.100\.[12])$/);
        if (hopVal === "100" || hopVal === "1000000") {
          // Chain has only 2 items, hops is 100, must fall back to fingerprint!
          expect(ip).toMatch(/^fp_[0-9a-f]{16}$/);
        }
      }
    });

    it("Complex multi-hop chain with mixed IPv4, bracketed IPv6 with port, and quotes", () => {
      process.env.TRUSTED_PROXY_HOPS = "2";
      const complexHeader = '"192.0.2.1", "198.51.100.1:8080", [2001:db8:acad::1]:443, 203.0.113.195';
      const req = new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": complexHeader },
      });

      // Chain length is 4. Hops=2 -> index 4 - 2 = 2 -> [2001:db8:acad::1]:443 -> normalized to 2001:db8:acad::1
      const ip = getClientIp(req);
      expect(ip).toBe("2001:db8:acad::1");
    });
  });

  // =========================================================================
  // 2. HIGH-CONCURRENCY CLIENT FINGERPRINTING & LOCKOUT ISOLATION (1,000 CLIENTS)
  // =========================================================================
  describe("High-Concurrency Client Fingerprinting & Collision Resistance", () => {
    it("Simulates 1,000 distinct mock requests: 0 hash collisions and strict format compliance", () => {
      const COUNT = 1000;
      const fingerprints = new Set<string>();
      const rateLimitKeys = new Set<string>();

      for (let i = 0; i < COUNT; i++) {
        const req = new Request(`http://localhost/api/test?client=${i}`, {
          headers: {
            "user-agent": `StressClientBot/${1 + (i % 50)}.0 (${i % 2 === 0 ? "Windows NT 10.0" : "Linux x86_64"}) Instance-${i}`,
            "accept-language": i % 3 === 0 ? "en-US,en;q=0.9" : i % 3 === 1 ? "ru-RU,ru;q=0.8" : "zh-CN,zh;q=0.7",
            "sec-ch-ua": `"Chromium";v="${100 + (i % 30)}", "Not=A?Brand";v="24"`,
            "sec-ch-ua-platform": i % 2 === 0 ? `"Windows"` : `"Linux"`,
            "host": `cluster-${i % 10}.platform.local`,
          },
        });

        const fp = getClientFingerprint(req);
        expect(fp).toMatch(/^fp_[0-9a-f]{16}$/);
        fingerprints.add(fp);

        const key = getClientRateLimitKey(req, "auth-login");
        expect(key).toContain(fp);
        rateLimitKeys.add(key);
      }

      // Assert zero collisions across 1,000 unique client request header profiles
      expect(fingerprints.size).toBe(COUNT);
      expect(rateLimitKeys.size).toBe(COUNT);
    });

    it("Verifies anti-DoS lockout isolation among 1,000 distinct clients using BoundedMemoryRateLimiter", () => {
      const COUNT = 1000;
      const limiter = new BoundedMemoryRateLimiter(2000);
      const clients: { id: number; key: string }[] = [];

      for (let i = 0; i < COUNT; i++) {
        const req = new Request("http://localhost/api/test", {
          headers: {
            "user-agent": `WorkerBot/${i}`,
            "accept-language": `lang-${i}`,
            "sec-ch-ua-platform": `Platform-${i}`,
          },
        });
        clients.push({ id: i, key: getClientRateLimitKey(req, "api-endpoint") });
      }

      // Target victim / attacker: client #0
      const attacker = clients[0];
      const maxAttempts = 5;
      const windowMs = 60000;

      // Exhaust limit for attacker (5 allowed, 6th blocked)
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const allowed = limiter.check(attacker.key, maxAttempts, windowMs, true);
        expect(allowed).toBe(true);
      }
      const attackerBlocked = limiter.check(attacker.key, maxAttempts, windowMs, true);
      expect(attackerBlocked).toBe(false);

      // Verify the remaining 999 benign clients are NOT locked out!
      let blockedCount = 0;
      for (let i = 1; i < COUNT; i++) {
        const allowed = limiter.check(clients[i].key, maxAttempts, windowMs, true);
        if (!allowed) blockedCount++;
      }

      expect(blockedCount).toBe(0);
      expect(limiter.check(attacker.key, maxAttempts, windowMs, false)).toBe(false);
    });
  });

  // =========================================================================
  // 3. BOUNDED MEMORY STRESS TEST (50,000 EVALUATIONS)
  // =========================================================================
  describe("Bounded Memory Stress Test (50,000 Evaluations)", () => {
    it("Simulates 50,000 distinct rate limit evaluations without crash, verifying memory cap and LRU eviction", () => {
      const MAX_ENTRIES = 5000;
      const TOTAL_EVALUATIONS = 50000;
      const limiter = new BoundedMemoryRateLimiter(MAX_ENTRIES);

      // Force GC if available or record initial heap
      if (global.gc) {
        global.gc();
      }
      const initialHeap = process.memoryUsage().heapUsed;
      const startTime = Date.now();

      for (let i = 0; i < TOTAL_EVALUATIONS; i++) {
        const key = `flood_key_${i}`;
        const allowed = limiter.check(key, 5, 60000, true);
        expect(allowed).toBe(true);

        // Periodically verify size cap
        if (i % 5000 === 0) {
          expect(limiter.size()).toBeLessThanOrEqual(MAX_ENTRIES);
        }
      }

      const elapsedMs = Date.now() - startTime;
      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMb = (finalHeap - initialHeap) / (1024 * 1024);

      // 1. Strict memory ceiling: size must be exactly MAX_ENTRIES
      expect(limiter.size()).toBe(MAX_ENTRIES);

      // 2. Heap stability: heap growth must be strictly bounded (less than 60MB delta for 50k evaluations)
      expect(heapDeltaMb).toBeLessThan(60);

      // 3. Verify LRU eviction behavior:
      // Early keys (e.g. key_0 to key_1000) must have been evicted
      const store = (limiter as unknown as RateLimiterInternals).store;
      for (let i = 0; i < 100; i++) {
        const entry = store.get(`flood_key_${i}`);
        expect(entry).toBeUndefined();
      }

      // Recent keys (e.g. flood_key_49000 to flood_key_49999) must be retained
      for (let i = TOTAL_EVALUATIONS - 100; i < TOTAL_EVALUATIONS; i++) {
        const entry = store.get(`flood_key_${i}`);
        expect(entry).toBeDefined();
        expect(entry?.count).toBe(1);
      }

      // 4. Verify LRU touch refresh behavior:
      // Touch a specific key to refresh its recency
      const touchKey = `flood_key_${TOTAL_EVALUATIONS - 50}`;
      limiter.check(touchKey, 5, 60000, true); // count becomes 2, moved to end of Map

      // Now insert another key to trigger eviction
      limiter.check("trigger_eviction_key", 5, 60000, true);

      // Size still capped
      expect(limiter.size()).toBe(MAX_ENTRIES);
      // The touched key MUST still exist with count = 2
      const touchedEntry = store.get(touchKey);
      expect(touchedEntry).toBeDefined();
      expect(touchedEntry?.count).toBe(2);

      console.log(`[Stress Test Benchmark] 50,000 evaluations completed in ${elapsedMs}ms (${(TOTAL_EVALUATIONS / (elapsedMs / 1000)).toFixed(0)} ops/sec). Heap delta: ${heapDeltaMb.toFixed(2)} MB.`);
    }, 30000); // 30s timeout for stress run

    it("Verifies TTL expiration priority over LRU eviction when expired keys exist", async () => {
      const limiter = new BoundedMemoryRateLimiter(3);
      // Insert key1 with short TTL (15ms)
      limiter.check("short_lived", 5, 15, true);
      // Insert key2 and key3 with long TTL (10000ms)
      limiter.check("long_lived_1", 5, 10000, true);
      limiter.check("long_lived_2", 5, 10000, true);

      expect(limiter.size()).toBe(3);

      // Wait 30ms for short_lived to expire
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Now insert 4th key: "new_key"
      // Eviction must sweep the expired "short_lived" entry, preserving the unexpired LRU "long_lived_1"
      limiter.check("new_key", 5, 10000, true);

      const store = (limiter as unknown as RateLimiterInternals).store;
      expect(limiter.size()).toBe(3);
      expect(store.get("short_lived")).toBeUndefined();
      expect(store.get("long_lived_1")).toBeDefined();
      expect(store.get("long_lived_2")).toBeDefined();
      expect(store.get("new_key")).toBeDefined();
    });
  });
});

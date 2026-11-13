import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import net from "net";
import { getClientIp } from "@/lib/ip";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { createRequest, invokeRoute } from "../helpers/e2e-client";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

describe("Tier 1 Feature Coverage: R8 Safe Client IP Extraction & Anti-DoS", () => {
  const origHops = process.env.TRUSTED_PROXY_HOPS;
  const origTrustHeaders = process.env.TRUST_PROXY_HEADERS;

  beforeEach(async () => {
    await db.rateLimitRecord.deleteMany();
    delete process.env.TRUSTED_PROXY_HOPS;
    delete process.env.TRUST_PROXY_HEADERS;
  });

  afterEach(async () => {
    await db.rateLimitRecord.deleteMany();
    if (origHops !== undefined) {
      process.env.TRUSTED_PROXY_HOPS = origHops;
    } else {
      delete process.env.TRUSTED_PROXY_HOPS;
    }
    if (origTrustHeaders !== undefined) {
      process.env.TRUST_PROXY_HEADERS = origTrustHeaders;
    } else {
      delete process.env.TRUST_PROXY_HEADERS;
    }
  });

  afterAll(() => {
    if (origHops !== undefined) {
      process.env.TRUSTED_PROXY_HOPS = origHops;
    } else {
      delete process.env.TRUSTED_PROXY_HOPS;
    }
    if (origTrustHeaders !== undefined) {
      process.env.TRUST_PROXY_HEADERS = origTrustHeaders;
    } else {
      delete process.env.TRUST_PROXY_HEADERS;
    }
  });

  /**
   * TC-R8-01: Right-Edge IP Extraction with TRUSTED_PROXY_HOPS=1
   */
  it("TC-R8-01: Extracts rightmost IP for hops=1, ignoring client-spoofed prefix", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";

    const req = createRequest("/api/test", {
      headers: {
        "x-forwarded-for": "198.51.100.1, 203.0.113.195",
      },
    });

    const ip = getClientIp(req);
    expect(ip).toBe("203.0.113.195");
    expect(net.isIP(ip)).not.toBe(0);
  });

  /**
   * TC-R8-02: Multi-Hop Right-Edge Extraction with TRUSTED_PROXY_HOPS=2
   */
  it("TC-R8-02: Extracts second hop from right for hops=2", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";

    const req = createRequest("/api/test", {
      headers: {
        "x-forwarded-for": "192.0.2.1, 203.0.113.50, 10.0.0.1",
      },
    });

    const ip = getClientIp(req);
    expect(ip).toBe("203.0.113.50");
    expect(net.isIP(ip)).not.toBe(0);
  });

  /**
   * TC-R8-03: Insufficient Proxy Hops Rejection (No Leftmost Fallback)
   */
  it("TC-R8-03: Rejects insufficient proxy hops without falling back to client-controlled parts[0]", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";

    const req = createRequest("/api/test", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
      },
    });

    const ip = getClientIp(req);
    // Leftmost attacker-supplied IP must NOT be trusted
    expect(ip).not.toBe("1.2.3.4");
  });

  /**
   * TC-R8-04: Strict IP Format Validation via net.isIP
   */
  it("TC-R8-04: Rejects malformed IPs (ports, domains, injection strings) via net.isIP", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";

    const malformedCandidates = [
      "203.0.113.195:8080",
      "malicious.domain.com",
      "' OR 1=1; --",
      "<script>alert(1)</script>",
    ];

    for (const candidate of malformedCandidates) {
      const req = createRequest("/api/test", {
        headers: {
          "x-forwarded-for": candidate,
        },
      });

      const ip = getClientIp(req);
      // Extracted IP must never be the raw malformed string
      expect(ip).not.toBe(candidate);
      if (ip !== "unknown" && !ip.startsWith("fp_")) {
        expect(net.isIP(ip)).not.toBe(0);
      }
    }
  });

  /**
   * TC-R8-05: Non-Shared Rate-Limit Fallback Key (Anti-Global DoS Verification)
   */
  it("TC-R8-05: Unresolved client fallback does not share a static key causing global DoS", async () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    delete process.env.TRUST_PROXY_HEADERS;

    const emailVictim = `victim-${Date.now()}@test.uz`;
    const emailLegit = `legit-${Date.now()}@test.uz`;

    const userVictim = await db.platformUser.create({
      data: {
        email: emailVictim,
        fullName: "Victim Account",
        passwordHash: await hashPassword("VictimPassword123!"),
        platformRole: "NONE",
        emailVerified: new Date(),
      },
    });

    const userLegit = await db.platformUser.create({
      data: {
        email: emailLegit,
        fullName: "Legitimate Account",
        passwordHash: await hashPassword("LegitPassword123!"),
        platformRole: "NONE",
        emailVerified: new Date(),
      },
    });

    try {
      // Attacker brute-forces victim account 5 times with failed logins
      for (let i = 0; i < 5; i++) {
        const failRes = await invokeRoute(loginRoute, "/api/auth/login", {
          method: "POST",
          headers: {
            "User-Agent": "AttackerBot/1.0",
          },
          body: { email: emailVictim, password: "WrongPassword!" },
        });
        expect(failRes.status).toBe(401);
      }

      // Victim account is locked out on this IP/fingerprint
      const lockedRes = await invokeRoute(loginRoute, "/api/auth/login", {
        method: "POST",
        headers: {
          "User-Agent": "AttackerBot/1.0",
        },
        body: { email: emailVictim, password: "VictimPassword123!" },
      });
      expect(lockedRes.status).toBe(401);

      // Legitimate user on another client is NOT locked out!
      const legitRes = await invokeRoute(loginRoute, "/api/auth/login", {
        method: "POST",
        headers: {
          "User-Agent": "LegitBrowser/1.0",
        },
        body: { email: emailLegit, password: "LegitPassword123!" },
      });
      expect(legitRes.status).toBe(200);
    } finally {
      await db.loginAttempt.deleteMany({
        where: { email: { in: [emailVictim, emailLegit] } },
      });
      await db.platformUser.deleteMany({
        where: { id: { in: [userVictim.id, userLegit.id] } },
      });
    }
  });
});

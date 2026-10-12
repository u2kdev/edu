import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { getClientIp } from "../src/lib/ip";
import { checkRateLimit, rateLimits } from "../src/lib/rate-limit";
import { POST as loginRoute } from "../src/app/api/auth/login/route";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

describe("TRUST-3 Item 2: getClientIp proxy security, default unknown, NaN handling, and lockout isolation", () => {
  const origHops = process.env.TRUSTED_PROXY_HOPS;
  const origTrustHeaders = process.env.TRUST_PROXY_HEADERS;

  beforeEach(() => {
    rateLimits.clear();
    delete process.env.TRUSTED_PROXY_HOPS;
    delete process.env.TRUST_PROXY_HEADERS;
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

  afterEach(() => {
    rateLimits.clear();
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

  it("default (hops not set or 0): returns 'unknown', ignores spoofed x-forwarded-for, cf-connecting-ip and x-real-ip", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        "cf-connecting-ip": "9.9.9.9",
        "x-real-ip": "8.8.8.8",
      },
    });
    const ip = getClientIp(req);
    expect(ip).toBe("unknown");
  });

  it("TRUST_PROXY_HEADERS=true allows cf-connecting-ip and x-real-ip when hops=0", () => {
    process.env.TRUST_PROXY_HEADERS = "true";

    const reqCf = new Request("http://localhost/api/test", {
      headers: {
        "cf-connecting-ip": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
      },
    });
    expect(getClientIp(reqCf)).toBe("1.1.1.1");

    const reqReal = new Request("http://localhost/api/test", {
      headers: {
        "x-real-ip": "2.2.2.2",
      },
    });
    expect(getClientIp(reqReal)).toBe("2.2.2.2");
  });

  it("hops=1: takes length-1 from right (last hop)", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "198.51.100.1, 203.0.113.5",
      },
    });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("hops=2: takes length-2 from right (2nd from end)", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "198.51.100.1, 203.0.113.5, 10.0.0.1",
      },
    });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("NaN or negative hops is treated as 0 and returns 'unknown'", () => {
    process.env.TRUSTED_PROXY_HOPS = "not-a-number";
    const req1 = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    expect(getClientIp(req1)).toBe("unknown");

    process.env.TRUSTED_PROXY_HOPS = "-5";
    const req2 = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    expect(getClientIp(req2)).toBe("unknown");
  });

  it("rate limit keys never contain 'undefined'", () => {
    const testKeys = ["unknown", "1.2.3.4_login", "unknown_register"];
    for (const key of testKeys) {
      expect(key.includes("undefined")).toBe(false);
      checkRateLimit(key, 10, 60000);
      expect(rateLimits.has(key)).toBe(true);
      rateLimits.delete(key);
    }
  });

  it("lockout is per (account, IP) and account GLOBAL: 'unknown' IP lockout on user A does not lock out user B", async () => {
    const emailA = `victim-a-${Date.now()}@t3i2.com`;
    const emailB = `user-b-${Date.now()}@t3i2.com`;

    const userA = await db.platformUser.create({
      data: { email: emailA, fullName: "Victim A", passwordHash: await hashPassword("PassA12345!"), platformRole: "NONE", emailVerified: new Date() },
    });
    const userB = await db.platformUser.create({
      data: { email: emailB, fullName: "User B", passwordHash: await hashPassword("PassB12345!"), platformRole: "NONE", emailVerified: new Date() },
    });

    try {
      // Cause 5 failed logins for userA with IP="unknown"
      for (let i = 0; i < 5; i++) {
        const reqFail = new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailA, password: "WrongPassword!" }),
        });
        const res = await loginRoute(reqFail);
        expect(res.status).toBe(401);
      }

      // User A is now locked out on IP "unknown"
      const reqLocked = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailA, password: "PassA12345!" }),
      });
      const resLocked = await loginRoute(reqLocked);
      expect(resLocked.status).toBe(401); // IP lockout blocks login for user A

      // BUT User B with same IP "unknown" can successfully log in!
      const reqUserB = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailB, password: "PassB12345!" }),
      });
      const resUserB = await loginRoute(reqUserB);
      expect(resUserB.status).toBe(200);
    } finally {
      await db.loginAttempt.deleteMany({ where: { email: { in: [emailA, emailB] } } });
      await db.platformUser.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    }
  });

  it("at 0 hops behind a proxy, lockout of one user on IP does not lock out all users at once (composite email, IP key architecture)", async () => {
    // hops is deleted (0 hops)
    delete process.env.TRUSTED_PROXY_HOPS;
    delete process.env.TRUST_PROXY_HEADERS;

    const emailVictim = `victim-zero-hops-${Date.now()}@proxytest.com`;
    const emailLegit = `legit-zero-hops-${Date.now()}@proxytest.com`;

    const userVictim = await db.platformUser.create({
      data: { email: emailVictim, fullName: "Victim 0 Hops", passwordHash: await hashPassword("VictimPass123!"), platformRole: "NONE", emailVerified: new Date() },
    });
    const userLegit = await db.platformUser.create({
      data: { email: emailLegit, fullName: "Legit 0 Hops", passwordHash: await hashPassword("LegitPass123!"), platformRole: "NONE", emailVerified: new Date() },
    });

    try {
      // Proxy sends x-forwarded-for header, but since hops=0, getClientIp returns "unknown"
      const proxyHeaders = {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.195",
      };

      // Attacker brute-forces emailVictim 5 times behind proxy
      for (let i = 0; i < 5; i++) {
        const reqFail = new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: proxyHeaders,
          body: JSON.stringify({ email: emailVictim, password: "WrongPass!" }),
        });
        const res = await loginRoute(reqFail);
        expect(res.status).toBe(401);
      }

      // Verify emailVictim is locked out on composite key (emailVictim, "unknown")
      const reqLocked = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: proxyHeaders,
        body: JSON.stringify({ email: emailVictim, password: "VictimPass123!" }),
      });
      const resLocked = await loginRoute(reqLocked);
      expect(resLocked.status).toBe(401);

      // Verify emailLegit behind the SAME proxy with SAME "unknown" resolved IP is NOT locked out!
      const reqLegit = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: proxyHeaders,
        body: JSON.stringify({ email: emailLegit, password: "LegitPass123!" }),
      });
      const resLegit = await loginRoute(reqLegit);
      expect(resLegit.status).toBe(200);
    } finally {
      await db.loginAttempt.deleteMany({ where: { email: { in: [emailVictim, emailLegit] } } });
      await db.platformUser.deleteMany({ where: { id: { in: [userVictim.id, userLegit.id] } } });
    }
  });
});

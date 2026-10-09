import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getClientIp } from "../src/lib/ip";

describe("TRUST-2 Item 11: getClientIp trusted proxy hops security", () => {
  const origHops = process.env.TRUSTED_PROXY_HOPS;

  beforeEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  afterEach(() => {
    if (origHops !== undefined) {
      process.env.TRUSTED_PROXY_HOPS = origHops;
    } else {
      delete process.env.TRUSTED_PROXY_HOPS;
    }
  });

  it("default (hops=0): ignores spoofed x-forwarded-for header", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      },
    });
    const ip = getClientIp(req);
    expect(ip).not.toBe("1.2.3.4");
    expect(ip).not.toBe("5.6.7.8");
    expect(ip).toBe("127.0.0.1");
  });

  it("hops=1: trusts the last proxy hop from x-forwarded-for", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "198.51.100.1, 203.0.113.5",
      },
    });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("hops=2: trusts the 2nd hop from end of x-forwarded-for", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "198.51.100.1, 203.0.113.5",
      },
    });
    expect(getClientIp(req)).toBe("198.51.100.1");
  });
});

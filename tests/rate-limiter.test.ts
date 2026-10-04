import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, clearRateLimit } from "../src/lib/rate-limit";

describe("Rate Limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Assuming clearRateLimit exists for tests or we just use different IP keys
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow requests under the limit", () => {
    const ip = "192.168.1.1";
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(ip)).toBe(true);
    }
  });

  it("should block requests over the limit", () => {
    const ip = "192.168.1.2";
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip);
    }
    // 11th request should be blocked
    expect(checkRateLimit(ip)).toBe(false);
  });

  it("should reset window after timeout", () => {
    const ip = "192.168.1.3";
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip);
    }
    expect(checkRateLimit(ip)).toBe(false);

    // Fast forward 15 minutes + 1 second
    vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

    expect(checkRateLimit(ip)).toBe(true);
  });

  it("different keys are independent", () => {
    const ip1 = "192.168.1.4";
    const ip2 = "192.168.1.5";

    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip1);
    }
    expect(checkRateLimit(ip1)).toBe(false);
    expect(checkRateLimit(ip2)).toBe(true);
  });
});

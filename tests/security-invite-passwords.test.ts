import { describe, it, expect } from "vitest";
import { generateSecureInviteCode } from "../src/lib/invites";
import { registerSchema } from "../src/lib/validation/auth";

describe("TRUST-2 Item 12: Invite codes generation & Register password policy", () => {
  it("generateSecureInviteCode produces cryptographically random code with length >= 12", () => {
    const code = generateSecureInviteCode();
    expect(code.length).toBeGreaterThanOrEqual(12);
    // Should be uppercase alphanumeric
    expect(/^[A-Z0-9]+$/.test(code)).toBe(true);

    // Verify entropy across 10 generations
    const codes = new Set(Array.from({ length: 10 }, () => generateSecureInviteCode()));
    expect(codes.size).toBe(10);
  });

  it("registerSchema rejects passwords shorter than 10 chars", () => {
    const res = registerSchema.safeParse({
      email: "test@example.com",
      password: "pass1",
      fullName: "Test User",
      inviteCode: "ABCDEF123456",
    });
    expect(res.success).toBe(false);
  });

  it("registerSchema rejects passwords equal to email", () => {
    const res = registerSchema.safeParse({
      email: "testuser@example.com",
      password: "testuser@example.com",
      fullName: "Test User",
      inviteCode: "ABCDEF123456",
    });
    expect(res.success).toBe(false);
  });

  it("registerSchema rejects passwords longer than 128 chars", () => {
    const res = registerSchema.safeParse({
      email: "test@example.com",
      password: "a".repeat(129),
      fullName: "Test User",
      inviteCode: "ABCDEF123456",
    });
    expect(res.success).toBe(false);
  });

  it("registerSchema accepts valid passwords (>= 10 chars, not equal to email, <= 128)", () => {
    const res = registerSchema.safeParse({
      email: "test@example.com",
      password: "SuperSecretPassword123!",
      fullName: "Test User",
      inviteCode: "ABCDEF123456",
    });
    expect(res.success).toBe(true);
  });
});

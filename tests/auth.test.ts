import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { z } from "zod";
import { loginSchema } from "../src/lib/validation/auth";
import { checkRateLimit, clearRateLimit } from "../src/lib/rate-limit";
import { apiError, handleApiError } from "../src/lib/api-response";
import { POST as loginPost } from "../src/app/api/auth/login/route";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

let mockToken = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    set: vi.fn((name, value) => {
      mockToken = value;
    }),
  }),
}));

const mockRequest = (body: any, ip: string = "127.0.0.1") => {
  const req = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
  return req;
};

describe("Authentication & Foundation Tests", () => {
  describe("Zod Auth Schemas", () => {
    it("should validate valid login data", () => {
      const data = { email: "test@example.com", password: "Password123!" };
      const res = loginSchema.safeParse(data);
      expect(res.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const data = { email: "invalid-email", password: "Password123!" };
      const res = loginSchema.safeParse(data);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toBe("auth.email.invalid");
      }
    });

    it("should reject short password", () => {
      const data = { email: "test@example.com", password: "123" };
      const res = loginSchema.safeParse(data);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toBe("auth.password.min_6");
      }
    });
  });

  describe("Rate Limiter", () => {
    beforeEach(() => {
      clearRateLimit("192.168.1.1");
    });

    it("should allow requests under the limit", () => {
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit("192.168.1.1")).toBe(true);
      }
    });

    it("should block requests over the limit", () => {
      for (let i = 0; i < 10; i++) {
        checkRateLimit("192.168.1.1");
      }
      expect(checkRateLimit("192.168.1.1")).toBe(false); // 11th request blocked
    });
  });

  describe("API Response format", () => {
    it("should format apiError correctly", async () => {
      const res = apiError("Test message", "NOT_FOUND", 404, { extra: 1 });
      const data = await res.json();
      expect(res.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("NOT_FOUND");
      expect(data.error.message).toBe("Test message");
      expect(data.error.details.extra).toBe(1);
    });

    it("should handle ZodError correctly", async () => {
      const zErr = loginSchema.safeParse({ email: "bad" });
      if (!zErr.success) {
        const res = handleApiError(zErr.error);
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error.code).toBe("VALIDATION_ERROR");
        expect(data.error.details[0].message).toBe("auth.email.invalid");
      }
    });
  });

  describe("Login API Endpoint", () => {
    let testUserId = "";

    beforeAll(async () => {
      const pHash = await hashPassword("Pass123!");
      const u = await db.platformUser.create({
        data: {
          email: `login-test-${Date.now()}@e2e.com`,
          passwordHash: pHash,
          fullName: "Login Test User",
          platformRole: "FULL_ACCESS"
        }
      });
      testUserId = u.id;
    });

    afterAll(async () => {
      if (testUserId) {
        await db.auditLog.deleteMany({ where: { actorUserId: testUserId } });
        await db.platformUser.delete({ where: { id: testUserId } });
      }
    });

    beforeEach(() => {
      clearRateLimit("test-ip");
    });

    it("should fail with invalid credentials and log audit", async () => {
      const req = mockRequest({ email: "wrong@email.com", password: "wrong_password" }, "test-ip");
      const res = await loginPost(req);
      const data = await res.json();
      
      expect(res.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");

      // Verify audit log (since it's an unknown user, it's hard to fetch by actor, but we can check the IP)
      const logs = await db.auditLog.findMany({ where: { ipAddress: "test-ip", action: "LOGIN_FAILED" } });
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should rate limit after 10 failures", async () => {
      let res;
      for (let i = 0; i < 11; i++) {
        const req = mockRequest({ email: "wrong@email.com", password: "wrong_password" }, "test-ip-limit");
        res = await loginPost(req);
      }
      expect(res!.status).toBe(429);
      const data = await res!.json();
      expect(data.error.code).toBe("RATE_LIMITED");
    });

    it("should succeed with correct credentials and clear rate limit", async () => {
      const user = await db.platformUser.findUnique({ where: { id: testUserId } });
      
      const req = mockRequest({ email: user!.email, password: "Pass123!" }, "test-ip-success");
      const res = await loginPost(req);
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe(user!.email);

      // Verify success audit log
      const log = await db.auditLog.findFirst({
        where: { actorUserId: testUserId, action: "LOGIN_SUCCESS" }
      });
      expect(log).toBeDefined();
    });
  });
});

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { POST as loginUser } from "../src/app/api/auth/login/route";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => ({
    set: mockSet,
    get: mockGet,
    delete: mockDelete,
  }),
}));

describe("Login API", () => {
  let user: string;
  const email = `login-${Date.now()}@test.com`;

  beforeAll(async () => {
    const u = await db.platformUser.create({
      data: {
        email,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Test Login User",
      }
    });
    user = u.id;
  });

  beforeEach(() => {
    mockSet.mockClear();
    mockDelete.mockClear();
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorUserId: user } });
    await db.userSession.deleteMany({ where: { userId: user } });
    await db.platformUser.delete({ where: { id: user } });
  });

  const mockReq = (body: any, ip: string = "127.0.0.1") => {
    return new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });
  };

  it("success: returns 200, creates UserSession, sets cookie, writes AuditLog", async () => {
    const res = await loginUser(mockReq({ email, password: "ValidPass123!" }, "1.2.3.4"));
    expect(res.status).toBe(200);

    const audit = await db.auditLog.findFirst({
      where: { actorUserId: user, action: "LOGIN_SUCCESS", ipAddress: "1.2.3.4" }
    });
    expect(audit).not.toBeNull();

    const session = await db.userSession.findFirst({
      where: { userId: user, ipAddress: "1.2.3.4" }
    });
    expect(session).not.toBeNull();

    expect(mockSet).toHaveBeenCalledWith("auth_token", expect.any(String), expect.any(Object));
  });

  it("invalid password: gives 401, no session/cookie, writes AuditLog", async () => {
    const res = await loginUser(mockReq({ email, password: "WrongPassword" }, "5.6.7.8"));
    expect(res.status).toBe(401);

    const audit = await db.auditLog.findFirst({
      where: { actorUserId: user, action: "LOGIN_FAILED", ipAddress: "5.6.7.8" }
    });
    expect(audit).not.toBeNull();

    const session = await db.userSession.findFirst({
      where: { userId: user, ipAddress: "5.6.7.8" }
    });
    expect(session).toBeNull();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("rate limit: gives 429 after 10 failures", async () => {
    const rateLimitIp = "9.9.9.9";
    for (let i = 0; i < 10; i++) {
      await loginUser(mockReq({ email, password: "WrongPassword" }, rateLimitIp));
    }
    const res = await loginUser(mockReq({ email, password: "WrongPassword" }, rateLimitIp));
    expect(res.status).toBe(429);
  });
});

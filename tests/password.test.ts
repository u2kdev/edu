import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { POST as forgotPassword } from "../src/app/api/auth/password/forgot/route";
import { POST as resetPassword } from "../src/app/api/auth/password/reset/route";
import { POST as changePassword } from "../src/app/api/auth/password/change/route";
import { db } from "../src/lib/db";
import { signJWT, hashJti, hashPassword, comparePassword } from "../src/lib/auth";
import crypto from "crypto";

let mockToken = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
  }),
}));

describe("Password Reset & Change API", () => {
  let user: string;
  let session1: string;

  beforeAll(async () => {
    const pwHash = await hashPassword("OldPassword123");
    const u = await db.platformUser.create({ 
      data: { email: `pwd-${Date.now()}@test.com`, passwordHash: pwHash, fullName: "Pwd User", emailVerified: new Date() } 
    });
    user = u.id;
    
    const s1 = await db.userSession.create({
      data: { userId: user, jtiHash: hashJti("jti_pwd"), expiresAt: new Date(Date.now() + 100000) }
    });
    session1 = s1.id;
  });

  afterAll(async () => {
    await db.userSession.deleteMany({ where: { userId: user } });
    await db.passwordResetToken.deleteMany({ where: { userId: user } });
    await db.platformUser.deleteMany({ where: { id: user } });
  });

  const mockReq = (url: string, body: unknown) => new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "x-forwarded-for": "1.1.1.1" },
    body: JSON.stringify(body)
  });

  it("forgot password: same response for existing and non-existing user", async () => {
    const start1 = Date.now();
    const res1 = await forgotPassword(mockReq("/api/auth/password/forgot", { email: "fake@test.com" }));
    const time1 = Date.now() - start1;
    const json1 = await res1.json();
    
    const start2 = Date.now();
    const userObj = await db.platformUser.findUnique({ where: { id: user } });
    const res2 = await forgotPassword(mockReq("/api/auth/password/forgot", { email: userObj!.email }));
    const time2 = Date.now() - start2;
    const json2 = await res2.json();

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(json1.success).toBe(true);
    expect(json2.success).toBe(true);

    // Difference in time shouldn't be huge (more than 100ms) - preventing timing attack
    expect(Math.abs(time1 - time2)).toBeLessThan(150);

    const tokens = await db.passwordResetToken.findMany({ where: { userId: user } });
    expect(tokens.length).toBe(1);
  });

  it("reset password: valid token changes password and revokes sessions", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    
    await db.passwordResetToken.create({
      data: { userId: user, tokenHash, expiresAt: new Date(Date.now() + 100000) }
    });

    const res = await resetPassword(mockReq("/api/auth/password/reset", { token: rawToken, newPassword: "NewPassword123" }));
    expect(res.status).toBe(200);

    const checkUser = await db.platformUser.findUnique({ where: { id: user } });
    const match = await comparePassword("NewPassword123", checkUser!.passwordHash);
    expect(match).toBe(true);

    const s1Check = await db.userSession.findUnique({ where: { id: session1 } });
    expect(s1Check?.revokedAt).not.toBeNull();
  });

  it("reset password: used token is rejected", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    
    await db.passwordResetToken.create({
      data: { userId: user, tokenHash, expiresAt: new Date(Date.now() + 100000), usedAt: new Date() }
    });

    const res = await resetPassword(mockReq("/api/auth/password/reset", { token: rawToken, newPassword: "NewPassword124" }));
    expect(res.status).toBe(400);
  });

  it("reset password: expired token is rejected", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    
    await db.passwordResetToken.create({
      data: { userId: user, tokenHash, expiresAt: new Date(Date.now() - 100000) } // past
    });

    const res = await resetPassword(mockReq("/api/auth/password/reset", { token: rawToken, newPassword: "NewPassword124" }));
    expect(res.status).toBe(400);
  });

  it("change password: wrong current password fails", async () => {
    // Re-create a valid session since it was revoked
    await db.userSession.update({ where: { id: session1 }, data: { revokedAt: null } });
    mockToken = signJWT({ userId: user, email: "pwd@test.com", platformRole: "NONE" }, "7d", "jti_pwd");

    const res = await changePassword(mockReq("/api/auth/password/change", { currentPassword: "WrongPassword", newPassword: "AnotherPassword123" }));
    expect(res.status).toBe(400);
  });

  it("change password: valid current password changes password", async () => {
    const s2 = await db.userSession.create({
      data: { userId: user, jtiHash: hashJti("jti_other"), expiresAt: new Date(Date.now() + 100000) }
    });

    mockToken = signJWT({ userId: user, email: "pwd@test.com", platformRole: "NONE" }, "7d", "jti_pwd");
    const res = await changePassword(mockReq("/api/auth/password/change", { currentPassword: "NewPassword123", newPassword: "ThirdPassword123" }));
    expect(res.status).toBe(200);

    const checkUser = await db.platformUser.findUnique({ where: { id: user } });
    const match = await comparePassword("ThirdPassword123", checkUser!.passwordHash);
    expect(match).toBe(true);

    const s1Check = await db.userSession.findUnique({ where: { id: session1 } });
    expect(s1Check?.revokedAt).toBeNull(); // Current session not revoked

    const s2Check = await db.userSession.findUnique({ where: { id: s2.id } });
    expect(s2Check?.revokedAt).not.toBeNull(); // Other sessions revoked
  });

  it("reset password: password matching email is rejected", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    
    await db.passwordResetToken.create({
      data: { userId: user, tokenHash, expiresAt: new Date(Date.now() + 100000) }
    });

    const userObj = await db.platformUser.findUnique({ where: { id: user } });
    const res = await resetPassword(mockReq("/api/auth/password/reset", { token: rawToken, newPassword: userObj!.email }));
    expect(res.status).toBe(400);
  });

  it("forgot password: rate limit", async () => {
    const rateLimitIp = "9.9.9.9";
    for (let i = 0; i < 10; i++) {
      await forgotPassword(
        new Request(`http://localhost/api/auth/password/forgot`, {
          method: "POST", headers: { "x-forwarded-for": rateLimitIp }, body: JSON.stringify({ email: "test@test.com" })
        })
      );
    }
    const res = await forgotPassword(
      new Request(`http://localhost/api/auth/password/forgot`, {
        method: "POST", headers: { "x-forwarded-for": rateLimitIp }, body: JSON.stringify({ email: "test@test.com" })
      })
    );
    expect(res.status).toBe(429);
  });
});

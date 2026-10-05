import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as loginPost } from "../src/app/api/auth/login/route";
import { db } from "../src/lib/db";

describe("Brute-force Lockout API", () => {
  let testEmail = `lockout-${Date.now()}@test.com`;

  beforeAll(async () => {
    await db.platformUser.create({
      data: {
        email: testEmail,
        passwordHash: "$2b$10$XyYj0O1P1/xW.xH0.zZ/O..rXz3ZzXzXzXzXzXzXzXzXzXzXzXzXzX", // invalid
        fullName: "Lockout Tester",
      }
    });
  });

  afterAll(async () => {
    await db.platformUser.deleteMany({ where: { email: testEmail } });
    await db.loginAttempt.deleteMany({ where: { email: testEmail } });
  });

  const mockReq = (ip: string) =>
    new Request(`http://localhost/api/auth/login`, {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify({ email: testEmail, password: "wrongpassword", rememberMe: false }),
    });

  it("Locks out after 5 attempts on the same IP", async () => {
    const ip = "1.2.3.4";
    // 5 attempts
    for (let i = 0; i < 5; i++) {
      const res = await loginPost(mockReq(ip));
      expect(res.status).toBe(401);
    }
    
    // Check DB lockout
    const attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip } } });
    expect(attempt?.attempts).toBe(5);
    expect(attempt?.lockoutUntil).not.toBeNull();
    
    // 6th attempt should be locked out (same response, but lockout triggered)
    const res6 = await loginPost(mockReq(ip));
    expect(res6.status).toBe(401);

    // Another IP shouldn't be locked out immediately, though password is still wrong
    const resOther = await loginPost(mockReq("5.6.7.8"));
    expect(resOther.status).toBe(401);
    const attemptOther = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip: "5.6.7.8" } } });
    expect(attemptOther?.attempts).toBe(1);
    expect(attemptOther?.lockoutUntil).toBeNull(); // not locked out yet
  });
});

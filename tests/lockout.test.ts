import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { POST as loginPost } from "../src/app/api/auth/login/route";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

describe("Brute-force Lockout API", () => {
  let testEmail = `lockout-${Date.now()}@test.com`;
  let nonExistentEmail = `nonexist-${Date.now()}@test.com`;

  beforeAll(async () => {
    vi.useFakeTimers();
    const phash = await hashPassword("correctpassword");
    await db.platformUser.create({
      data: {
        email: testEmail,
        passwordHash: phash,
        fullName: "Lockout Tester",
      }
    });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.platformUser.deleteMany({ where: { email: testEmail } });
    await db.loginAttempt.deleteMany({ where: { email: testEmail } });
    await db.loginAttempt.deleteMany({ where: { email: nonExistentEmail } });
  });

  const mockReq = (email: string, ip: string, pass: string = "wrongpassword") =>
    new Request(`http://localhost/api/auth/login`, {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify({ email, password: pass, rememberMe: false }),
    });

  it("Progressive delay, IP independent, fake timers unlock, success resets", async () => {
    const ip1 = "1.2.3.4";
    
    // 5 attempts -> 1 minute lockout
    for (let i = 0; i < 5; i++) {
      const res = await loginPost(mockReq(testEmail, ip1));
      expect(res.status).toBe(401);
    }
    
    let attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip: ip1 } } });
    expect(attempt?.attempts).toBe(5);
    expect(attempt?.lockoutUntil).not.toBeNull();
    
    // 6th attempt should be locked out
    let res = await loginPost(mockReq(testEmail, ip1));
    expect(res.status).toBe(401);

    // Another IP shouldn't be locked out
    let resOther = await loginPost(mockReq(testEmail, "5.6.7.8"));
    expect(resOther.status).toBe(401);
    let attemptOther = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip: "5.6.7.8" } } });
    expect(attemptOther?.attempts).toBe(1);
    expect(attemptOther?.lockoutUntil).toBeNull();

    // Advance 61 seconds to clear 1 min lockout
    vi.advanceTimersByTime(61 * 1000);
    
    // Now it's unlocked but we fail again -> 6th attempt -> no lockout yet (next is 10)
    res = await loginPost(mockReq(testEmail, ip1));
    expect(res.status).toBe(401);
    attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip: ip1 } } });
    expect(attempt?.attempts).toBe(6);
    expect(attempt?.lockoutUntil).toBeNull();

    // Fail up to 10 attempts -> 15 mins lockout
    for (let i = 0; i < 4; i++) {
      await loginPost(mockReq(testEmail, ip1));
    }
    attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip: ip1 } } });
    expect(attempt?.attempts).toBe(10);
    expect(attempt?.lockoutUntil).not.toBeNull(); // 15 mins

    // Advance 16 mins
    vi.advanceTimersByTime(16 * 60 * 1000);

    // Successful login resets counter
    res = await loginPost(mockReq(testEmail, ip1, "correctpassword"));
    expect(res.status).toBe(200);

    attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip: ip1 } } });
    expect(attempt).toBeNull(); // deleted
  });

  it("Non-existent email behaves exactly the same (counter, status, response)", async () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < 5; i++) {
      const res = await loginPost(mockReq(nonExistentEmail, ip));
      expect(res.status).toBe(401);
    }
    
    let attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: nonExistentEmail, ip } } });
    expect(attempt?.attempts).toBe(5);
    expect(attempt?.lockoutUntil).not.toBeNull();

    let res = await loginPost(mockReq(nonExistentEmail, ip));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toBe("auth.invalidCredentials");
  });
});

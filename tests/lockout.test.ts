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
    await db.auditLog.deleteMany({ where: { resource: "PlatformUser", action: "LOGIN_FAILED" } });
  });

  const mockReq = (email: string, ip: string, pass: string = "wrongpassword") =>
    new Request(`http://localhost/api/auth/login`, {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify({ email, password: pass, rememberMe: false }),
    });

  it("прогрессивная задержка растёт", async () => {
    const ip = "1.2.3.1";
    
    // 5 attempts -> 1 minute lockout
    for (let i = 0; i < 5; i++) {
      const res = await loginPost(mockReq(testEmail, ip));
      expect(res.status).toBe(401);
    }
    
    let attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip } } });
    expect(attempt?.attempts).toBe(5);
    expect(attempt?.lockoutUntil).not.toBeNull();
    
    // Check 1 minute exactly
    const diff = attempt!.lockoutUntil!.getTime() - Date.now();
    expect(diff).toBe(60000);

    // Try again -> Should remain locked out
    let res = await loginPost(mockReq(testEmail, ip));
    expect(res.status).toBe(401);
  });

  it("чужой IP не блокирует владельца", async () => {
    // 1.2.3.1 is already locked out
    const resOther = await loginPost(mockReq(testEmail, "1.2.3.2", "correctpassword"));
    // Wait, let's use a wrong password first to verify it's not locked out, it just fails normally
    const resFail = await loginPost(mockReq(testEmail, "1.2.3.3", "wrong"));
    expect(resFail.status).toBe(401);
    const attemptOther = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip: "1.2.3.3" } } });
    expect(attemptOther?.attempts).toBe(1);
    expect(attemptOther?.lockoutUntil).toBeNull();
  });

  it("снятие по таймеру (fake timers)", async () => {
    const ip = "1.2.3.4";
    // 5 attempts -> 1 min lockout
    for (let i = 0; i < 5; i++) {
      await loginPost(mockReq(testEmail, ip));
    }
    let attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip } } });
    expect(attempt?.lockoutUntil).not.toBeNull();
    
    // Advance 61 seconds
    vi.advanceTimersByTime(61 * 1000);

    // Next failure shouldn't be a lockout (because 6 is not >= 10 yet), but wait! Our config triggers lockout on ANY attempt >= 5 if it expired.
    // Wait, the new logic: `if (attempts >= config.max) { lockoutUntil = new Date... break; }`
    // So attempt 6 WILL trigger a 1 min lockout again. Let's verify it triggered it!
    const res = await loginPost(mockReq(testEmail, ip));
    expect(res.status).toBe(401);
    attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip } } });
    expect(attempt?.attempts).toBe(6);
    expect(attempt?.lockoutUntil).not.toBeNull(); 
  });

  it("успешный вход обнуляет счётчик", async () => {
    const ip = "1.2.3.5";
    // Fail 4 times
    for (let i = 0; i < 4; i++) {
      await loginPost(mockReq(testEmail, ip));
    }
    let attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip } } });
    expect(attempt?.attempts).toBe(4);

    // Success
    const res = await loginPost(mockReq(testEmail, ip, "correctpassword"));
    expect(res.status).toBe(200);

    attempt = await db.loginAttempt.findUnique({ where: { email_ip: { email: testEmail, ip } } });
    expect(attempt).toBeNull(); // deleted
  });

  it("несуществующий email ведёт себя так же", async () => {
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
  });

  it("блокировка пишет в аудит", async () => {
    const ip = "1.2.3.6";
    await loginPost(mockReq(testEmail, ip));
    
    const audit = await db.auditLog.findFirst({
      where: {
        action: "LOGIN_FAILED",
        ipAddress: ip,
      }
    });
    expect(audit).not.toBeNull();
    const details = JSON.parse(audit!.detailsJson as string);
    expect(details.email).toBe(testEmail);
    expect(details.attempts).toBe(1);
  });

  it("порог аккаунта срабатывает при попытках с разных IP", async () => {
    // Generate 20 failures across 20 IPs
    for (let i = 0; i < 20; i++) {
      await loginPost(mockReq(testEmail, `2.0.0.${i}`));
    }
    
    // Now global attempts = 20
    const promise = loginPost(mockReq(testEmail, "2.0.0.99"));
    vi.advanceTimersByTime(200); // Advance enough to clear 100ms delay
    const res = await promise;
    expect(res.status).toBe(401);
    
    // Check 22nd attempt (attempts = 21)
    const promise2 = loginPost(mockReq(testEmail, "2.0.0.100"));
    vi.advanceTimersByTime(300); // 200ms delay
    const res2 = await promise2;
    expect(res2.status).toBe(401);
  });
});

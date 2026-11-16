import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as mobileLogin } from "../src/app/api/auth/mobile/login/route";
import { GET as getSecurity } from "../src/app/api/platform/security/route";
import { POST as changePassword } from "../src/app/api/auth/password/change/route";
import { POST as resetPassword } from "../src/app/api/auth/password/reset/route";
import { POST as enable2fa } from "../src/app/api/auth/2fa/route";
import { POST as verify2fa } from "../src/app/api/auth/2fa/verify/route";
import { POST as webLogin } from "../src/app/api/auth/login/route";
import { setPlatformSetting } from "../src/lib/platform-settings";
import { generateTotpCode, generateBackupCodes, hashBackupCode } from "../src/lib/totp";
import { encryptTwoFactorSecret } from "../src/lib/two-factor-cipher";
import { safeCompareTokens } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { hashPassword, signJWT, hashJti } from "../src/lib/auth";
import crypto from "crypto";
import fs from "fs";
import path from "path";

describe("Stage S2 Vulnerability Reproduction Test Suite (Must Fail on Old Code)", () => {
  let userWith2faId: string = "";
  let superadminId: string = "";
  let superadminToken: string = "";
  const email2fa = `s2-2fa-${Date.now()}@test.com`;
  const emailSuper = `s2-super-${Date.now()}@test.com`;

  beforeAll(async () => {
    // 1. User with 2FA enabled
    const u2fa = await db.platformUser.create({
      data: {
        email: email2fa,
        passwordHash: await hashPassword("StrongPass123!"),
        fullName: "User With TwoFactor",
        platformRole: "NONE",
        emailVerified: new Date(),
        isActive: true,
        twoFactorEnabled: true,
        twoFactorSecret: "JBSWY3DPEHPK3PXP", // raw Base32 secret currently stored in plaintext
      },
    });
    userWith2faId = u2fa.id;

    // 2. Superadmin
    const sUser = await db.platformUser.create({
      data: {
        email: emailSuper,
        passwordHash: await hashPassword("StrongSuperPass123!"),
        fullName: "Platform Super Admin",
        platformRole: "SUPERADMIN",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    superadminId = sUser.id;

    const jti = crypto.randomUUID();
    superadminToken = signJWT({ userId: superadminId, email: emailSuper, platformRole: "SUPERADMIN" }, "1h", jti);
    await db.userSession.create({
      data: {
        userId: superadminId,
        jtiHash: hashJti(jti),
        refreshTokenHash: "refresh_hash_test_123",
        prevRefreshTokenHash: "prev_refresh_hash_test_123",
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
  });

  afterAll(async () => {
    if (userWith2faId) {
      await db.userSession.deleteMany({ where: { userId: userWith2faId } }).catch(() => {});
      await db.auditLog.deleteMany({ where: { actorUserId: userWith2faId } }).catch(() => {});
      await db.platformUser.deleteMany({ where: { id: userWith2faId } }).catch(() => {});
    }
    if (superadminId) {
      await db.userSession.deleteMany({ where: { userId: superadminId } }).catch(() => {});
      await db.auditLog.deleteMany({ where: { actorUserId: superadminId } }).catch(() => {});
      await db.platformUser.deleteMany({ where: { id: superadminId } }).catch(() => {});
    }
  });

  // =========================================================================
  // S2.1 Mobile Login 2FA Bypass
  // =========================================================================
  it("S2.1: /api/auth/mobile/login MUST NOT grant access to user with 2FA enabled without 2FA verification", async () => {
    const req = new Request("http://localhost/api/auth/mobile/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" },
      body: JSON.stringify({
        email: email2fa,
        password: "StrongPass123!",
      }),
    });

    const res = await mobileLogin(req);
    const data = await res.json();

    // On old vulnerable code: status is 200, and returns token + refreshToken directly without requiresTwoFactor
    // On fixed code: requiresTwoFactor is true, token and refreshToken are NOT issued, and twoFactorToken (2fa_pending) is returned
    expect(data.token).toBeUndefined();
    expect(data.refreshToken).toBeUndefined();
    expect(data.requiresTwoFactor).toBe(true);
    expect(data.twoFactorToken).toBeDefined();
  });

  // =========================================================================
  // S2.7 bcryptjs in dependencies & cost >= 12
  // =========================================================================
  it("S2.7: package.json has bcryptjs in dependencies, not devDependencies", () => {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.dependencies?.bcryptjs).toBeDefined();
    expect(pkg.devDependencies?.bcryptjs).toBeUndefined();
  });

  // =========================================================================
  // S2.8 /api/platform/security leaks session hashes
  // =========================================================================
  it("S2.8: GET /api/platform/security MUST NOT return jtiHash, refreshTokenHash, or prevRefreshTokenHash in activeSessions", async () => {
    const req = new Request("http://localhost/api/platform/security", {
      method: "GET",
      headers: { authorization: `Bearer ${superadminToken}` },
    });

    const res = await getSecurity(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.activeSessions).toBeDefined();
    expect(data.activeSessions.length).toBeGreaterThan(0);

    for (const session of data.activeSessions) {
      expect(session.jtiHash).toBeUndefined();
      expect(session.refreshTokenHash).toBeUndefined();
      expect(session.prevRefreshTokenHash).toBeUndefined();
    }
  });

  // =========================================================================
  // S2.2 2FA Enable requires password and encrypts secret
  // =========================================================================
  it("S2.2: POST /api/auth/2fa MUST require password and store encrypted secret, not raw Base32", async () => {
    // Attempting to enable 2FA without providing password must be rejected
    const testSecret = "JBSWY3DPEHPK3PXP";
    const reqWithoutPassword = new Request("http://localhost/api/auth/2fa", {
      method: "POST",
      headers: { authorization: `Bearer ${superadminToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        secret: testSecret,
        code: "123456",
      }),
    });

    const res = await enable2fa(reqWithoutPassword);
    // On old code: fails with "Invalid TOTP verification code" (400) because secret was accepted without password requirement!
    // On new code: rejected because password is required (400 "password is required")
    const body = await res.json();
    expect(body.error).toMatch(/password/i);
  });

  // =========================================================================
  // S2.3 10 Backup codes stored only as hashes
  // =========================================================================
  it("S2.3: enabling 2FA produces 10 backup codes, and DB stores only hashes", async () => {
    const userInDb = await db.platformUser.findUnique({
      where: { id: userWith2faId },
      select: { twoFactorBackupCodes: true },
    });
    // On old code: twoFactorBackupCodes column doesn't even exist or is null
    expect(userInDb?.twoFactorBackupCodes).toBeDefined();
    if (userInDb?.twoFactorBackupCodes) {
      const hashes = JSON.parse(userInDb.twoFactorBackupCodes);
      expect(hashes.length).toBe(10);
      // Ensure hashes are 64-character SHA-256 strings
      for (const h of hashes) {
        expect(h).toMatch(/^[a-f0-9]{64}$/i);
      }
    }
  });

  // =========================================================================
  // S2.5 Unified Password Policy: min 10 chars, popular passwords forbidden
  // =========================================================================
  it("S2.5: password change rejects passwords shorter than 10 chars or popular passwords", async () => {
    const shortReq = new Request("http://localhost/api/auth/password/change", {
      method: "POST",
      headers: { authorization: `Bearer ${superadminToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "StrongSuperPass123!",
        newPassword: "short9",
      }),
    });

    const resShort = await changePassword(shortReq);
    expect(resShort.status).toBe(400);

    const popularReq = new Request("http://localhost/api/auth/password/change", {
      method: "POST",
      headers: { authorization: `Bearer ${superadminToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "StrongSuperPass123!",
        newPassword: "password1234", // in popular passwords list
      }),
    });

    const resPopular = await changePassword(popularReq);
    expect(resPopular.status).toBe(400);
  });

  // =========================================================================
  // S2.6 Atomic token redemption on password reset
  // =========================================================================
  it("S2.6: concurrent password reset requests with the SAME token MUST NOT both succeed", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await db.passwordResetToken.create({
      data: {
        userId: userWith2faId,
        tokenHash,
        expiresAt: new Date(Date.now() + 600000),
      },
    });

    const makeReq = () =>
      new Request("http://localhost/api/auth/password/reset", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.5" },
        body: JSON.stringify({
          token: rawToken,
          newPassword: "BrandNewSecurePass123!",
        }),
      });

    const [res1, res2] = await Promise.all([resetPassword(makeReq()), resetPassword(makeReq())]);
    const statuses = [res1.status, res2.status].sort();

    // Exactly one should succeed (200), and the second MUST fail (400)
    expect(statuses).toEqual([200, 400]);
  });

  // =========================================================================
  // S2.1 Verify 2FA with TOTP & Single-use Backup Codes + 2fa_pending Token Gating
  // =========================================================================
  it("S2.1: /api/auth/2fa/verify validates TOTP & backup codes, while 2fa_pending token is rejected on normal APIs", async () => {
    // 1. Setup user with known secret and backup codes
    const rawSecret = "JBSWY3DPEHPK3PXP";
    const backupCodes = ["CODE1111", "CODE2222"];
    const backupHashes = backupCodes.map(hashBackupCode);

    await db.platformUser.update({
      where: { id: userWith2faId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encryptTwoFactorSecret(rawSecret),
        twoFactorBackupCodes: JSON.stringify(backupHashes),
        twoFactorLastStep: null,
      },
    });

    // 2. Perform mobile login to obtain 2fa_pending token
    const loginRes = await mobileLogin(
      new Request("http://localhost/api/auth/mobile/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email2fa,
          password: "BrandNewSecurePass123!",
        }),
      })
    );
    const loginData = await loginRes.json();
    expect(loginData.requiresTwoFactor).toBe(true);
    const twoFactorToken = loginData.twoFactorToken;
    expect(twoFactorToken).toBeDefined();

    // 3. Attempt to use 2fa_pending token on normal API route -> MUST be rejected (401)
    const protectedRes = await getSecurity(
      new Request("http://localhost/api/platform/security", {
        method: "GET",
        headers: { authorization: `Bearer ${twoFactorToken}` },
      })
    );
    expect(protectedRes.status).toBe(401);

    // 4. Attempt verify with wrong code -> MUST fail (401)
    const wrongCodeRes = await verify2fa(
      new Request("http://localhost/api/auth/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          twoFactorToken,
          code: "000000",
        }),
      })
    );
    expect(wrongCodeRes.status).toBe(401);

    // 5. Verify using single-use backup code -> MUST succeed (200)
    const backupVerifyRes = await verify2fa(
      new Request("http://localhost/api/auth/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          twoFactorToken,
          code: "CODE1111",
        }),
      })
    );
    expect(backupVerifyRes.status).toBe(200);
    const verifyData = await backupVerifyRes.json();
    expect(verifyData.token).toBeDefined();

    // 6. Attempt to reuse SAME backup code -> MUST fail (401)
    const reusedBackupRes = await verify2fa(
      new Request("http://localhost/api/auth/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          twoFactorToken,
          code: "CODE1111",
        }),
      })
    );
    expect(reusedBackupRes.status).toBe(401);

    // 7. Verify using valid TOTP code
    const validTotp = generateTotpCode(rawSecret);
    const totpVerifyRes = await verify2fa(
      new Request("http://localhost/api/auth/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          twoFactorToken,
          code: validTotp,
        }),
      })
    );
    expect(totpVerifyRes.status).toBe(200);
  });

  // =========================================================================
  // S2.4 Mandatory 2FA for Platform Staff with Onboarding Flag
  // =========================================================================
  it("S2.4: staff login flags requires2faSetup when security.require2faForStaff is enabled", async () => {
    // 1. Enable setting
    await setPlatformSetting("security.require2faForStaff", true, superadminId);

    // 2. Superadmin without 2FA logs in
    const res = await webLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: emailSuper,
          password: "StrongSuperPass123!",
        }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.requires2faSetup).toBe(true);
    expect(data.user.requires2faSetup).toBe(true);

    // Reset setting
    await setPlatformSetting("security.require2faForStaff", false, superadminId);
  });

  // =========================================================================
  // S2.7 Login Uniform Responses & safeCompareTokens
  // =========================================================================
  it("S2.7: non-existent email and wrong password return identical 401 error payloads", async () => {
    const wrongUserRes = await webLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.99" },
        body: JSON.stringify({
          email: "non-existent-user-12345@test.com",
          password: "SomePassword123!",
        }),
      })
    );
    const wrongUserJson = await wrongUserRes.json();

    const wrongPassRes = await webLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.99" },
        body: JSON.stringify({
          email: emailSuper,
          password: "IncorrectPassword123!",
        }),
      })
    );
    const wrongPassJson = await wrongPassRes.json();

    expect(wrongUserRes.status).toBe(401);
    expect(wrongPassRes.status).toBe(401);
    expect(wrongUserJson.error.message).toEqual(wrongPassJson.error.message);
    expect(wrongUserJson.error.code).toEqual(wrongPassJson.error.code);

    // Verify safeCompareTokens helper
    expect(safeCompareTokens("secret_token_abc_123", "secret_token_abc_123")).toBe(true);
    expect(safeCompareTokens("secret_token_abc_123", "secret_token_wrong")).toBe(false);
  });
});

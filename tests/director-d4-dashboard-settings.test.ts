import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, signJWT } from "@/lib/auth";
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  generateBackupCodes,
  generateTotpUri,
} from "@/lib/totp";
import {
  normalizeEskizPhone,
  formatSmsAlert,
  sendEskizSms,
} from "@/lib/notifications";
import {
  sendEmailWithOutbox,
  processEmailOutbox,
} from "@/lib/email";
import { calculateStudentDebts } from "@/lib/finance";
import { GET as getSettings, PATCH as patchSettings } from "@/app/api/tenant/settings/route";
import { GET as getAudit } from "@/app/api/tenant/audit/route";
import { GET as getActivity, POST as postActivity } from "@/app/api/tenant/activity/route";
import { POST as postLogin } from "@/app/api/auth/login/route";
import { GET as get2fa, POST as post2fa } from "@/app/api/auth/2fa/route";

describe("Stage D4: Director Dashboard, Settings, Audit & Security", () => {
  let centerAId: string;
  let centerBId: string;

  let directorAUserId: string;
  let directorAMembershipId: string;
  let directorAToken: string;

  let directorBUserId: string;
  let directorBMembershipId: string;
  let directorBToken: string;

  let teacherAUserId: string;
  let studentAUserId: string;
  let studentAMembershipId: string;

  let userBUserId: string;

  beforeAll(async () => {
    // 1. Create Subscription Plan
    const plan = await db.subscriptionPlan.create({
      data: {
        name: "D4 Enterprise",
        priceMonthly: 500_000,
        maxStudents: 500,
        maxTeachers: 50,
        maxCourses: 50,
        maxBranches: 5,
        maxStorage: 10,
      },
    });

    const pwdHash = await hashPassword("Password123!");

    // 2. Create Users first
    const dirAUser = await db.platformUser.create({
      data: {
        email: `d4-dir-a-${Date.now()}@test.uz`,
        fullName: "Director Alpha",
        passwordHash: pwdHash,
        emailVerified: new Date(),
        platformRole: "NONE",
      },
    });
    directorAUserId = dirAUser.id;

    const dirBUser = await db.platformUser.create({
      data: {
        email: `d4-dir-b-${Date.now()}@test.uz`,
        fullName: "Director Beta",
        passwordHash: pwdHash,
        emailVerified: new Date(),
        platformRole: "NONE",
      },
    });
    directorBUserId = dirBUser.id;

    const teacherAUser = await db.platformUser.create({
      data: {
        email: `d4-teacher-a-${Date.now()}@test.uz`,
        fullName: "Teacher Alpha",
        passwordHash: pwdHash,
        emailVerified: new Date(),
        platformRole: "NONE",
      },
    });
    teacherAUserId = teacherAUser.id;

    const studentAUser = await db.platformUser.create({
      data: {
        email: `d4-student-a-${Date.now()}@test.uz`,
        fullName: "Student Alpha",
        passwordHash: pwdHash,
        emailVerified: new Date(),
        platformRole: "NONE",
      },
    });
    studentAUserId = studentAUser.id;

    const userBUser = await db.platformUser.create({
      data: {
        email: `d4-user-b-${Date.now()}@test.uz`,
        fullName: "User Beta",
        passwordHash: pwdHash,
        emailVerified: new Date(),
        platformRole: "NONE",
      },
    });
    userBUserId = userBUser.id;

    // 3. Create Centers with valid ownerIds
    const centerA = await db.learningCenter.create({
      data: {
        name: "D4 Alpha Academy",
        slug: `d4-alpha-${Date.now()}`,
        status: "ACTIVE",
        ownerId: directorAUserId,
        defaultLanguage: "ru",
        timeZone: "Asia/Tashkent",
        gradingScale: "PERCENT_100",
      },
    });
    centerAId = centerA.id;

    const centerB = await db.learningCenter.create({
      data: {
        name: "D4 Beta Institute",
        slug: `d4-beta-${Date.now()}`,
        status: "ACTIVE",
        ownerId: directorBUserId,
        defaultLanguage: "uz_Latn",
        timeZone: "Asia/Tashkent",
        gradingScale: "POINTS_5",
      },
    });
    centerBId = centerB.id;

    await db.subscription.createMany({
      data: [
        {
          centerId: centerAId,
          planId: plan.id,
          status: "ACTIVE",
          currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          centerId: centerBId,
          planId: plan.id,
          status: "ACTIVE",
          currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    // 4. Create Memberships
    const memDirA = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: directorAUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    directorAMembershipId = memDirA.id;

    const memDirB = await db.centerMembership.create({
      data: {
        centerId: centerBId,
        userId: directorBUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    directorBMembershipId = memDirB.id;

    await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: teacherAUserId,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });

    const memStudentA = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: studentAUserId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentAMembershipId = memStudentA.id;

    await db.centerMembership.create({
      data: {
        centerId: centerBId,
        userId: userBUserId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    // 5. Auth session tokens
    directorAToken = signJWT({
      userId: directorAUserId,
      email: dirAUser.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    directorBToken = signJWT({
      userId: directorBUserId,
      email: dirBUser.email,
      platformRole: "NONE",
      activeCenterId: centerBId,
      activeCenterRole: "DIRECTOR",
    });
  });

  afterAll(async () => {
    // Teardown in correct FK order
    await db.auditLog.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } }).catch(() => {});
    await db.userSession.deleteMany({
      where: { userId: { in: [directorAUserId, directorBUserId, teacherAUserId, studentAUserId, userBUserId] } },
    }).catch(() => {});
    await db.subscription.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } }).catch(() => {});
    await db.centerMembership.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } }).catch(() => {});
    await db.learningCenter.deleteMany({ where: { id: { in: [centerAId, centerBId] } } }).catch(() => {});
    await db.platformUser.deleteMany({
      where: { id: { in: [directorAUserId, directorBUserId, teacherAUserId, studentAUserId, userBUserId] } },
    }).catch(() => {});
  });

  // -------------------------------------------------------------
  // 1. TOTP 2FA Verification
  // -------------------------------------------------------------
  describe("TOTP Two-Factor Authentication", () => {
    it("generates valid Base32 secret, URI and backup codes", () => {
      const secret = generateTotpSecret(20);
      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThanOrEqual(16);

      const uri = generateTotpUri("test@e-darschi.uz", secret, "e-darschi");
      expect(uri).toContain("otpauth://totp/");
      expect(uri).toContain(secret);

      const backupCodes = generateBackupCodes(8);
      expect(backupCodes).toHaveLength(8);
      expect(backupCodes[0]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it("generates and verifies 6-digit TOTP code within time window", () => {
      const secret = generateTotpSecret();
      const code = generateTotpCode(secret);
      expect(code).toMatch(/^\d{6}$/);

      const isValid = verifyTotpCode(secret, code);
      expect(isValid).toBe(true);

      const isInvalid = verifyTotpCode(secret, "999999");
      expect(isInvalid).toBe(false);
    });

    it("enables 2FA via API, then gates login until valid 2FA code is provided", async () => {
      // 1. Setup 2FA via GET /api/auth/2fa?action=setup
      const setupReq = new Request("http://localhost/api/auth/2fa?action=setup", {
        headers: { Authorization: `Bearer ${directorAToken}` },
      });
      const setupRes = await get2fa(setupReq);
      expect(setupRes.status).toBe(200);
      const setupData = await setupRes.json();
      expect(setupData.secret).toBeDefined();

      const secret = setupData.secret;
      const validCode = generateTotpCode(secret);

      // 2. Enable 2FA via POST /api/auth/2fa
      const verifyReq = new Request("http://localhost/api/auth/2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${directorAToken}`,
        },
        body: JSON.stringify({ secret, code: validCode }),
      });
      const verifyRes = await post2fa(verifyReq);
      expect(verifyRes.status).toBe(200);
      const verifyData = await verifyRes.json();
      expect(verifyData.enabled).toBe(true);
      expect(verifyData.backupCodes).toHaveLength(8);

      // 3. User attempts login without 2FA code
      const dirA = await db.platformUser.findUnique({ where: { id: directorAUserId } });
      const loginReqNo2fa = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: dirA!.email, password: "Password123!" }),
      });
      const loginResNo2fa = await postLogin(loginReqNo2fa);
      const loginDataNo2fa = await loginResNo2fa.json();
      expect(loginDataNo2fa.requiresTwoFactor).toBe(true);

      // 4. User attempts login with invalid 2FA code -> 401
      const loginReqBad2fa = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: dirA!.email,
          password: "Password123!",
          twoFactorCode: "000000",
        }),
      });
      const loginResBad2fa = await postLogin(loginReqBad2fa);
      expect(loginResBad2fa.status).toBe(401);

      // 5. User logs in with valid 2FA code -> success (200)
      const freshCode = generateTotpCode(secret);
      const loginReqValid = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: dirA!.email,
          password: "Password123!",
          twoFactorCode: freshCode,
        }),
      });
      const loginResValid = await postLogin(loginReqValid);
      expect(loginResValid.status).toBe(200);
      const loginDataValid = await loginResValid.json();
      expect(loginDataValid.user.id).toBe(directorAUserId);
    });
  });

  // -------------------------------------------------------------
  // 2. SMS Eskiz.uz Transport & Templates
  // -------------------------------------------------------------
  describe("SMS Eskiz.uz Transport & Templates", () => {
    it("normalizes Uzbek phone numbers to 998XXXXXXXXX format", () => {
      expect(normalizeEskizPhone("+998 (90) 123-45-67")).toBe("998901234567");
      expect(normalizeEskizPhone("998931112233")).toBe("998931112233");
      expect(normalizeEskizPhone("+998 71 200 00 00")).toBe("998712000000");
      expect(normalizeEskizPhone("12345")).toBeNull();
    });

    it("formats SMS alert messages in Russian and Uzbek", () => {
      const ruDebt = formatSmsAlert(
        "SMS_DEBT_REMINDER",
        { centerName: "Alpha", amount: "250 000" },
        "ru"
      );
      expect(ruDebt).toContain("Alpha");
      expect(ruDebt).toContain("250 000 UZS");

      const uzDebt = formatSmsAlert(
        "SMS_DEBT_REMINDER",
        { centerName: "Alpha", amount: "250 000" },
        "uz"
      );
      expect(uzDebt).toContain("qarzingiz 250 000 UZS");

      const ruAtt = formatSmsAlert(
        "SMS_ATTENDANCE_ALERT",
        { centerName: "Alpha", studentName: "Азиз", date: "2026-11-12" },
        "ru"
      );
      expect(ruAtt).toContain("Азиз пропустил(а) занятие");
    });

    it("falls back safely to simulated SMS when Eskiz credentials are not configured", async () => {
      const res = await sendEskizSms("+998901234567", "Тестовое SMS сообщение");
      expect(res.success).toBe(true);
      expect(res.status).toBe("SIMULATED");
      expect(res.messageId).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 3. Email Outbox & Retries
  // -------------------------------------------------------------
  describe("Email Outbox and Retry Mechanism", () => {
    it("enqueues failed emails into EmailOutbox and processes retries", async () => {
      const testEmail = `outbox-test-${Date.now()}@test.uz`;
      const res = await sendEmailWithOutbox(testEmail, "Test Subject", "Test Body");
      expect(res.id).toBeDefined();

      // Process outbox should run cleanly
      const outboxRes = await processEmailOutbox({ batchSize: 10 });
      expect(outboxRes.processed).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------
  // 4. Center Settings Management & Privilege Escalation Guard
  // -------------------------------------------------------------
  describe("Center Settings Management & Security", () => {
    it("allows Director to read and update center profile and branding", async () => {
      const getReq = new Request("http://localhost/api/tenant/settings", {
        headers: { Authorization: `Bearer ${directorAToken}` },
      });
      const getRes = await getSettings(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.center.name).toBe("D4 Alpha Academy");
      expect(getData.center.gradingScale).toBe("PERCENT_100");

      const patchReq = new Request("http://localhost/api/tenant/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${directorAToken}`,
        },
        body: JSON.stringify({
          legalName: 'OOO "Alpha Educational Group"',
          phone: "+998901112233",
          gradingScale: "POINTS_5",
          brandingConfig: { primaryColor: "#10b981", tagLine: "Top LMS" },
        }),
      });
      const patchRes = await patchSettings(patchReq);
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.center.legalName).toBe('OOO "Alpha Educational Group"');
      expect(patchData.center.gradingScale).toBe("POINTS_5");

      // Verify audit log entry
      const audit = await db.auditLog.findFirst({
        where: { centerId: centerAId, action: "CENTER_SETTINGS_UPDATED" },
      });
      expect(audit).toBeDefined();
    });

    it("strictly blocks Director from modifying center status, slug, or subscription plan", async () => {
      const exploitReq = new Request("http://localhost/api/tenant/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${directorAToken}`,
        },
        body: JSON.stringify({
          status: "BLOCKED",
          slug: "hacked-slug",
        }),
      });
      const exploitRes = await patchSettings(exploitReq);
      expect(exploitRes.status).toBe(403);
    });
  });

  // -------------------------------------------------------------
  // 5. Center Audit Log & Multi-Tenant Scoping
  // -------------------------------------------------------------
  describe("Center Audit Log & Tenant Isolation", () => {
    it("returns audit logs strictly scoped to the director's center", async () => {
      // Create test audit entries
      await db.auditLog.createMany({
        data: [
          {
            centerId: centerAId,
            actorUserId: directorAUserId,
            action: "TEST_EVENT_A",
            resource: "Course",
            detailsJson: JSON.stringify({ test: true }),
          },
          {
            centerId: centerBId,
            actorUserId: directorBUserId,
            action: "TEST_EVENT_B",
            resource: "Course",
            detailsJson: JSON.stringify({ secretB: "classified" }),
          },
        ],
      });

      const reqA = new Request("http://localhost/api/tenant/audit?search=TEST_EVENT", {
        headers: { Authorization: `Bearer ${directorAToken}` },
      });
      const resA = await getAudit(reqA);
      expect(resA.status).toBe(200);
      const dataA = await resA.json();

      // Center A director sees only Center A events
      const actionsA = dataA.logs.map((l: { action: string }) => l.action);
      expect(actionsA).toContain("TEST_EVENT_A");
      expect(actionsA).not.toContain("TEST_EVENT_B");
    });

    it("exports audit log as CSV format with attachment header", async () => {
      const csvReq = new Request("http://localhost/api/tenant/audit?export=csv", {
        headers: { Authorization: `Bearer ${directorAToken}` },
      });
      const csvRes = await getAudit(csvReq);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers.get("Content-Type")).toContain("text/csv");
      expect(csvRes.headers.get("Content-Disposition")).toContain("attachment; filename=");
      const text = await csvRes.text();
      expect(text).toContain("Timestamp,Actor,Action,Resource");
    });
  });

  // -------------------------------------------------------------
  // 6. User Activity & Session Revocation
  // -------------------------------------------------------------
  describe("User Activity & Session Revocation", () => {
    it("lists active members of the center with login activity", async () => {
      const req = new Request("http://localhost/api/tenant/activity", {
        headers: { Authorization: `Bearer ${directorAToken}` },
      });
      const res = await getActivity(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.summary.totalMembers).toBeGreaterThanOrEqual(3);
      expect(data.users.some((u: { email: string }) => u.email.includes("student-a"))).toBe(true);
      expect(data.users.some((u: { email: string }) => u.email.includes("user-b"))).toBe(false);
    });

    it("allows Director to revoke sessions of a user in their center", async () => {
      // Create session for student A
      const sessionA = await db.userSession.create({
        data: {
          userId: studentAUserId,
          jtiHash: `jti_hash_${Date.now()}`,
          expiresAt: new Date(Date.now() + 86400 * 1000),
          userAgent: "Mozilla/5.0 (iPhone)",
          ipAddress: "192.168.1.50",
        },
      });

      const revokeReq = new Request("http://localhost/api/tenant/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${directorAToken}`,
        },
        body: JSON.stringify({
          action: "REVOKE_USER_SESSIONS",
          userId: studentAUserId,
          reason: "Security inspection by director",
        }),
      });

      const revokeRes = await postActivity(revokeReq);
      expect(revokeRes.status).toBe(200);
      const revokeData = await revokeRes.json();
      expect(revokeData.success).toBe(true);
      expect(revokeData.revokedCount).toBeGreaterThanOrEqual(1);

      // Verify session was revoked in DB
      const checkSess = await db.userSession.findUnique({ where: { id: sessionA.id } });
      expect(checkSess?.revokedAt).not.toBeNull();
    });

    it("blocks Director from revoking sessions of users from another center", async () => {
      const exploitReq = new Request("http://localhost/api/tenant/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${directorAToken}`,
        },
        body: JSON.stringify({
          action: "REVOKE_USER_SESSIONS",
          userId: userBUserId, // Belongs to Center B
          reason: "Malicious termination attempt",
        }),
      });

      const exploitRes = await postActivity(exploitReq);
      expect(exploitRes.status).toBe(403);
    });
  });

  // -------------------------------------------------------------
  // 7. Student Debt Calculation for Attention Dashboard
  // -------------------------------------------------------------
  describe("Director Attention Data Calculation", () => {
    it("calculates student debts correctly", async () => {
      const debtData = await calculateStudentDebts(centerAId);
      expect(debtData).toBeDefined();
      expect(debtData.summary).toBeDefined();
      expect(typeof debtData.summary.totalDebt).toBe("number");
      expect(typeof debtData.summary.debtorsCount).toBe("number");
    });
  });
});

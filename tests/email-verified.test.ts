import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { POST as centerPaymentsPost } from "../src/app/api/center-payments/route";
import { POST as resetPassword } from "../src/app/api/auth/password/reset/route";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import crypto from "crypto";
import { signJWT } from "../src/lib/auth";

const mockSet = vi.fn();
const mockDelete = vi.fn();
let mockToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    set: mockSet,
    get: (name: string) => name === "auth_token" ? { value: mockToken } : undefined,
    delete: mockDelete,
  }),
}));

const mockReq = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.1.1.1",
    },
    body: JSON.stringify(body),
  });

describe("EmailVerified & Sensitive Actions", () => {
  const verifiedEmail = `verified-${Date.now()}@test.com`;
  const unverifiedEmail = `unverified-${Date.now()}@test.com`;
  let verifiedUserId: string;
  let unverifiedUserId: string;
  let centerId: string;
  let studentMembershipId: string;

  beforeAll(async () => {
    const pw = await hashPassword("password123");
    
    const u1 = await db.platformUser.create({
      data: { email: verifiedEmail, passwordHash: pw, fullName: "V User", emailVerified: new Date() }
    });
    verifiedUserId = u1.id;

    const u2 = await db.platformUser.create({
      data: { email: unverifiedEmail, passwordHash: pw, fullName: "U User" }
    });
    unverifiedUserId = u2.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Test Center",
        slug: `test-center-${Date.now()}`,
        owner: { connect: { id: verifiedUserId } },
        memberships: {
          create: [
            { userId: verifiedUserId, role: "DIRECTOR" },
            { userId: unverifiedUserId, role: "DIRECTOR" },
            { userId: u1.id, role: "STUDENT" }
          ]
        }
      },
      include: { memberships: true }
    });
    centerId = center.id;
    studentMembershipId = center.memberships.find(m => m.role === "STUDENT")!.id;
  });

  afterAll(async () => {
    await db.learningCenter.delete({ where: { id: centerId } });
    await db.platformUser.deleteMany({ where: { id: { in: [verifiedUserId, unverifiedUserId] } } });
  });

  const mockCenterReq = (url: string, body: unknown) =>
    new Request(`http://localhost${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.1.1.1",
        "x-center-id": centerId,
      },
      body: JSON.stringify(body),
    });

  it("Verified user can perform payment action", async () => {
    const jti = "hashv";
    const jtiHash = crypto.createHash("sha256").update(jti).digest("hex");
    const sess = await db.userSession.create({ data: { userId: verifiedUserId, expiresAt: new Date(Date.now() + 100000), ipAddress: "1", jtiHash } });
    mockToken = signJWT({ userId: verifiedUserId, email: verifiedEmail, platformRole: "NONE" }, "7d", jti);
    const res = await centerPaymentsPost(mockCenterReq("/api/center-payments", {
      studentMembershipId,
      amount: 100
    }));
    expect(res.status).toBe(200);
    await db.userSession.delete({ where: { id: sess.id } });
  });

  it("Unverified user gets 403 when trying to perform payment action", async () => {
    const jti = "hashu";
    const jtiHash = crypto.createHash("sha256").update(jti).digest("hex");
    const sess = await db.userSession.create({ data: { userId: unverifiedUserId, expiresAt: new Date(Date.now() + 100000), ipAddress: "1", jtiHash } });
    mockToken = signJWT({ userId: unverifiedUserId, email: unverifiedEmail, platformRole: "NONE" }, "7d", jti);
    const res = await centerPaymentsPost(mockCenterReq("/api/center-payments", {
      studentMembershipId,
      amount: 100
    }));
    expect(res.status).toBe(403);
    await db.userSession.delete({ where: { id: sess.id } });
  });

  it("Successful password reset sets emailVerified if it was empty, then user can perform payment", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    
    await db.passwordResetToken.create({
      data: { userId: unverifiedUserId, tokenHash, expiresAt: new Date(Date.now() + 100000) }
    });

    const resetRes = await resetPassword(mockReq("/api/auth/password/reset", { token: rawToken, newPassword: "resetpassword123" }));
    expect(resetRes.status).toBe(200);

    const userObj = await db.platformUser.findUnique({ where: { id: unverifiedUserId } });
    expect(userObj?.emailVerified).not.toBeNull();

    // Now try payment
    const jti = "hashu2";
    const jtiHashSess = crypto.createHash("sha256").update(jti).digest("hex");
    const sess = await db.userSession.create({ data: { userId: unverifiedUserId, expiresAt: new Date(Date.now() + 100000), ipAddress: "1", jtiHash: jtiHashSess } });
    
    mockToken = signJWT({ userId: unverifiedUserId, email: unverifiedEmail, platformRole: "NONE" }, "7d", jti);
    const payRes = await centerPaymentsPost(mockCenterReq("/api/center-payments", {
      studentMembershipId,
      amount: 100
    }));
    if (payRes.status !== 200) console.log(await payRes.json());
    expect(payRes.status).toBe(200);
    await db.userSession.delete({ where: { id: sess.id } });
  });
});

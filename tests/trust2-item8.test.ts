import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../src/lib/db";
import { getSentEmails, clearSentEmails } from "../src/lib/email";
import { POST as registerHandler } from "../src/app/api/auth/register/route";

describe("TRUST-2 Item 8: Email links for confirm-email and pending invite accept in ru/uz", () => {
  beforeEach(async () => {
    clearSentEmails();
  });

  it("sends confirmation email with valid token link in ru/uz for new user registration", async () => {
    const owner = await db.platformUser.create({
      data: {
        email: `owner8a-${Date.now()}@test.com`,
        passwordHash: "x",
        fullName: "Owner 8A",
      },
    });

    const center = await db.learningCenter.create({
      data: {
        name: "Item8 Center A",
        slug: `item8-center-${Date.now()}`,
        status: "ACTIVE",
        ownerId: owner.id,
      },
    });

    const creatorMem = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: owner.id,
        role: "CENTER_ADMIN",
      },
    });

    const code = `INV8A_${Date.now()}`;
    await db.inviteCode.create({
      data: {
        code,
        centerId: center.id,
        targetRole: "STUDENT",
        createdByMembershipId: creatorMem.id,
      },
    });

    const email = `newuser_ru_${Date.now()}@example.com`;
    const req = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "ru-RU,ru;q=0.9" },
      body: JSON.stringify({
        email,
        password: "ValidPassword123!",
        fullName: "New Student RU",
        inviteCode: code,
        locale: "ru",
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(200);

    const sent = getSentEmails();
    expect(sent.length).toBeGreaterThan(0);
    const userEmail = sent.find((m) => m.to === email);
    expect(userEmail).toBeDefined();
    // Must contain confirm link with token and ru lang
    expect(userEmail!.body).toMatch(/\/auth\/confirm-email\?token=[a-zA-Z0-9_-]+(&locale=ru|&lang=ru)/);
  });

  it("sends pending invite email with accept link in ru/uz for existing user", async () => {
    const owner = await db.platformUser.create({
      data: {
        email: `owner8b-${Date.now()}@test.com`,
        passwordHash: "x",
        fullName: "Owner 8B",
      },
    });

    const center = await db.learningCenter.create({
      data: {
        name: "Item8 Center B",
        slug: `item8-center-b-${Date.now()}`,
        status: "ACTIVE",
        ownerId: owner.id,
      },
    });

    const creatorMem = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: owner.id,
        role: "CENTER_ADMIN",
      },
    });

    const code = `INV8B_${Date.now()}`;
    await db.inviteCode.create({
      data: {
        code,
        centerId: center.id,
        targetRole: "TEACHER",
        createdByMembershipId: creatorMem.id,
      },
    });

    const existingEmail = `existing_uz_${Date.now()}@example.com`;
    await db.platformUser.create({
      data: {
        email: existingEmail,
        passwordHash: "hash123",
        fullName: "Existing User UZ",
      },
    });

    const req = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "uz" },
      body: JSON.stringify({
        email: existingEmail,
        password: "ValidPassword123!",
        fullName: "Existing User UZ",
        inviteCode: code,
        locale: "uz",
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(200);

    const sent = getSentEmails();
    const inviteMail = sent.find((m) => m.to === existingEmail);
    expect(inviteMail).toBeDefined();
    // Must contain accept link with pendingInviteId and uz lang
    expect(inviteMail!.body).toMatch(/\/auth\/invites\/accept\?pendingInviteId=[a-zA-Z0-9_-]+(&locale=uz|&lang=uz)/);
  });
});

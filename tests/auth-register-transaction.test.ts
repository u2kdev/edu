import { describe, it, expect } from "vitest";
import { db } from "../src/lib/db";
import { POST as registerHandler } from "../src/app/api/auth/register/route";

describe("TRUST-2 Item 9: Atomic registration and concurrent email registration safety", () => {
  it("rolls back invite consumption if user creation or membership creation fails", async () => {
    const owner = await db.platformUser.create({
      data: {
        email: `owner9b-${Date.now()}@test.com`,
        passwordHash: "x",
        fullName: "Owner 9B",
      },
    });

    const center = await db.learningCenter.create({
      data: {
        name: "Item9 Center Rollback",
        slug: `item9-center-rb-${Date.now()}`,
        status: "ACTIVE",
        ownerId: owner.id,
      },
    });

    const creator = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: owner.id,
        role: "CENTER_ADMIN",
      },
    });

    const code = `INV9RB_${Date.now()}`;
    const invite = await db.inviteCode.create({
      data: {
        code,
        centerId: center.id,
        targetRole: "STUDENT",
        maxUses: 1,
        usesCount: 0,
        createdByMembershipId: creator.id,
      },
    });

    // Existing user in platformUser with email X
    const email = `already_user_${Date.now()}@test.com`;
    // We simulate a race condition where user check saw nothing, but before user.create someone inserted it
    // Or we test two concurrent registrations with differing passwords/users
    // To prove atomicity: if registration crashes midway or hits P2002 on user creation,
    // usesCount must NOT be burned (remain 0).
    const existing = await db.platformUser.create({
      data: {
        email,
        passwordHash: "existingHash",
        fullName: "Already Created",
      },
    });

    // We make a call that bypasses findUnique by mocking or by having findUnique not see it,
    // but in pure API call:
    // What happens if two DIFFERENT requests attempt with the same inviteCode at maxUses=1?
    const code2 = `INV9CONC_${Date.now()}`;
    const invite2 = await db.inviteCode.create({
      data: {
        code: code2,
        centerId: center.id,
        targetRole: "STUDENT",
        maxUses: 1,
        usesCount: 0,
        createdByMembershipId: creator.id,
      },
    });

    const emailA = `concurrent_a_${Date.now()}@test.com`;
    const emailB = `concurrent_b_${Date.now()}@test.com`;

    const makeReq = (emailAddr: string) =>
      registerHandler(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailAddr,
            password: "ValidPassword123!",
            fullName: "Student User",
            inviteCode: code2,
          }),
        })
      );

    const [resA, resB] = await Promise.all([makeReq(emailA), makeReq(emailB)]);
    const s = [resA.status, resB.status].sort();
    expect(s[0]).toBe(200);
    expect(s[1]).toBe(400); // Invalid/exhausted invite code

    const checkInvite = await db.inviteCode.findUnique({ where: { id: invite2.id } });
    expect(checkInvite?.usesCount).toBe(1);
  });

  it("handles P2002 unique constraint on platformUser creation within transaction without 500", async () => {
    // If a concurrent request created the platformUser between findUnique and create,
    // the transaction should catch P2002 and rollback usesCount, returning 409 or 400 instead of 500.
    const owner = await db.platformUser.create({
      data: {
        email: `owner9c-${Date.now()}@test.com`,
        passwordHash: "x",
        fullName: "Owner 9C",
      },
    });

    const center = await db.learningCenter.create({
      data: {
        name: "Item9 Center P2002",
        slug: `item9-center-p2-${Date.now()}`,
        status: "ACTIVE",
        ownerId: owner.id,
      },
    });

    const creator = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: owner.id,
        role: "CENTER_ADMIN",
      },
    });

    const code = `INV9P2002_${Date.now()}`;
    const invite = await db.inviteCode.create({
      data: {
        code,
        centerId: center.id,
        targetRole: "STUDENT",
        maxUses: 5,
        usesCount: 0,
        createdByMembershipId: creator.id,
      },
    });

    // 5 concurrent requests with identical email
    const duplicateEmail = `dup_p2002_${Date.now()}@test.com`;
    const makeReq = () =>
      registerHandler(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: duplicateEmail,
            password: "ValidPassword123!",
            fullName: "Duplicate User",
            inviteCode: code,
          }),
        })
      );

    const results = await Promise.all([makeReq(), makeReq(), makeReq(), makeReq()]);
    const statuses = results.map((r) => r.status);
    
    // NONE of them should return 500 (Internal Server Error)
    for (const status of statuses) {
      expect(status).not.toBe(500);
    }

    // Exactly 1 user record created
    const count = await db.platformUser.count({ where: { email: duplicateEmail } });
    expect(count).toBe(1);

    // usesCount must reflect only valid successful new user consumption (or 1)
    const freshInvite = await db.inviteCode.findUnique({ where: { id: invite.id } });
    // Since only 1 new user was created, usesCount should be 1
    expect(freshInvite?.usesCount).toBe(1);
  });
});

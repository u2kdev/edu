import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../src/lib/db";
import { POST as acceptInviteHandler } from "../src/app/api/auth/invites/accept/route";

let currentSessionUser: { id: string; email: string } | null = null;

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(async () => {
    if (!currentSessionUser) return null;
    return {
      sessionId: "session-123",
      user: {
        id: currentSessionUser.id,
        email: currentSessionUser.email,
        platformRole: "NONE",
      },
    };
  }),
}));

describe("TRUST-2 Item 10: Atomic accept invite, blocked center check, audit, and role conflict", () => {
  let ownerUser: { id: string };
  let testUser: { id: string; email: string };

  beforeEach(async () => {
    const ts = Date.now() + Math.floor(Math.random() * 100000);
    ownerUser = await db.platformUser.create({
      data: {
        email: `owner10_${ts}@test.com`,
        passwordHash: "x",
        fullName: "Owner 10",
      },
    });

    testUser = await db.platformUser.create({
      data: {
        email: `invitee10_${ts}@test.com`,
        passwordHash: "x",
        fullName: "Invitee 10",
      },
    });

    currentSessionUser = testUser;
  });

  it("fails if center status is BLOCKED or CANCELLED", async () => {
    const center = await db.learningCenter.create({
      data: {
        name: "Blocked Center",
        slug: `blocked-center-${Date.now()}-${Math.random()}`,
        status: "BLOCKED",
        ownerId: ownerUser.id,
      },
    });

    const creator = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: ownerUser.id,
        role: "CENTER_ADMIN",
      },
    });

    const inviteCode = await db.inviteCode.create({
      data: {
        code: `INV10_BLOCKED_${Date.now()}`,
        centerId: center.id,
        targetRole: "STUDENT",
        createdByMembershipId: creator.id,
      },
    });

    const pending = await db.pendingInvite.create({
      data: {
        email: testUser.email,
        inviteCodeId: inviteCode.id,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const req = new Request("http://localhost:3000/api/auth/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingInviteId: pending.id }),
    });

    const res = await acceptInviteHandler(req);
    // Should be rejected because center is BLOCKED
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe("TENANT_BLOCKED");
  });

  it("handles concurrent double accept: only 1 succeeds, usesCount increments only once", async () => {
    const center = await db.learningCenter.create({
      data: {
        name: "Active Center Race",
        slug: `race-center-${Date.now()}-${Math.random()}`,
        status: "ACTIVE",
        ownerId: ownerUser.id,
      },
    });

    const creator = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: ownerUser.id,
        role: "CENTER_ADMIN",
      },
    });

    const inviteCode = await db.inviteCode.create({
      data: {
        code: `INV10_RACE_${Date.now()}`,
        centerId: center.id,
        targetRole: "STUDENT",
        maxUses: 5,
        usesCount: 0,
        createdByMembershipId: creator.id,
      },
    });

    const pending = await db.pendingInvite.create({
      data: {
        email: testUser.email,
        inviteCodeId: inviteCode.id,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const makeReq = () =>
      acceptInviteHandler(
        new Request("http://localhost:3000/api/auth/invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pendingInviteId: pending.id }),
        })
      );

    const [res1, res2] = await Promise.all([makeReq(), makeReq()]);
    const statuses = [res1.status, res2.status].sort();

    // Exactly one should succeed (200), other should fail (400)
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(400);

    const freshCode = await db.inviteCode.findUnique({ where: { id: inviteCode.id } });
    expect(freshCode?.usesCount).toBe(1);

    // Audit log was created for the accept event
    const auditLogs = await db.auditLog.findMany({
      where: {
        centerId: center.id,
        action: "INVITE_ACCEPTED",
      },
    });
    expect(auditLogs.length).toBe(1);
  });

  it("rejects with 409 ROLE_CONFLICT if user already has a DIFFERENT role in the center", async () => {
    const center = await db.learningCenter.create({
      data: {
        name: "Role Conflict Center",
        slug: `role-center-${Date.now()}-${Math.random()}`,
        status: "ACTIVE",
        ownerId: ownerUser.id,
      },
    });

    const creator = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: ownerUser.id,
        role: "CENTER_ADMIN",
      },
    });

    // Existing membership is TEACHER
    await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: testUser.id,
        role: "TEACHER",
      },
    });

    // Invite is for STUDENT
    const inviteCode = await db.inviteCode.create({
      data: {
        code: `INV10_ROLE_${Date.now()}`,
        centerId: center.id,
        targetRole: "STUDENT",
        createdByMembershipId: creator.id,
      },
    });

    const pending = await db.pendingInvite.create({
      data: {
        email: testUser.email,
        inviteCodeId: inviteCode.id,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const req = new Request("http://localhost:3000/api/auth/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingInviteId: pending.id }),
    });

    const res = await acceptInviteHandler(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error?.code).toBe("ROLE_CONFLICT");
  });
});

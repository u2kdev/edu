import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { POST as acceptInvite } from "../src/app/api/auth/invites/accept/route";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import crypto from "crypto";

import { signJWT } from "../src/lib/auth";

let mockToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => name === "auth_token" ? { value: mockToken } : undefined,
  }),
}));

const mockReq = (body: unknown) =>
  new Request(`http://localhost/api/auth/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PendingInvite API", () => {
  let centerId: string;
  let inviteId: string;
  let ownerId: string;
  let targetUserId: string;
  let targetSessionId: string;
  let otherUserId: string;
  let otherSessionId: string;
  let groupId: string;
  const targetEmail = `target-${Date.now()}@test.com`;
  const otherEmail = `other-${Date.now()}@test.com`;

  beforeAll(async () => {
    const pw = await hashPassword("pass");
    const centerOwner = await db.platformUser.create({
      data: { email: `owner-${Date.now()}@test.com`, passwordHash: pw, fullName: "Owner" }
    });
    ownerId = centerOwner.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Test Center",
        slug: `test-center-${Date.now()}`,
        owner: { connect: { id: ownerId } },
        memberships: {
          create: { userId: ownerId, role: "OWNER" }
        }
      },
      include: { memberships: true }
    });
    centerId = center.id;
    const membershipId = center.memberships[0].id;

    const course = await db.course.create({
      data: {
        title: "Test Course",
        centerId,
        createdByMembershipId: membershipId
      }
    });

    const group = await db.group.create({
      data: { name: "Test Group", centerId, courseId: course.id }
    });
    groupId = group.id;

    const targetUser = await db.platformUser.create({
      data: { email: targetEmail, passwordHash: pw, fullName: "Target" }
    });
    targetUserId = targetUser.id;
    const sess1 = await db.userSession.create({
      data: { userId: targetUserId, ipAddress: "1", expiresAt: new Date(Date.now() + 100000), jtiHash: crypto.createHash("sha256").update("hash1").digest("hex") }
    });
    targetSessionId = sess1.id;

    const otherUser = await db.platformUser.create({
      data: { email: otherEmail, passwordHash: pw, fullName: "Other" }
    });
    otherUserId = otherUser.id;
    const sess2 = await db.userSession.create({
      data: { userId: otherUserId, ipAddress: "1", expiresAt: new Date(Date.now() + 100000), jtiHash: crypto.createHash("sha256").update("hash2").digest("hex") }
    });
    otherSessionId = sess2.id;
  });

  afterAll(async () => {
    await db.userSession.deleteMany({ where: { id: { in: [targetSessionId, otherSessionId] } } });
    await db.learningCenter.deleteMany({ where: { id: centerId } });
    await db.platformUser.deleteMany({ where: { id: { in: [ownerId, targetUserId, otherUserId] } } });
  });

  it("Acceptance creates membership and Enrollment; without acceptance no membership and usesCount not deducted", async () => {
    // Create an invite code
    const invite = await db.inviteCode.create({
      data: {
        code: `INV-${Date.now()}`,
        centerId,
        targetRole: "STUDENT",
        groupId,
        maxUses: 10,
        createdByMembershipId: (await db.centerMembership.findFirst({ where: { userId: ownerId } }))!.id,
      }
    });

    const pending = await db.pendingInvite.create({
      data: { email: targetEmail, inviteCodeId: invite.id, expiresAt: new Date(Date.now() + 100000) }
    });

    // Verify before acceptance:
    let mem = await db.centerMembership.findFirst({ where: { userId: targetUserId, centerId } });
    expect(mem).toBeNull();
    let inviteFresh = await db.inviteCode.findUnique({ where: { id: invite.id } });
    expect(inviteFresh?.usesCount).toBe(0);

    // Accept
    mockToken = signJWT({ userId: targetUserId, email: targetEmail, platformRole: "NONE" }, "7d", "hash1");
    const res = await acceptInvite(mockReq({ pendingInviteId: pending.id }));
    expect(res.status).toBe(200);

    // Verify after acceptance:
    mem = await db.centerMembership.findFirst({ where: { userId: targetUserId, centerId } });
    expect(mem).not.toBeNull();
    const enroll = await db.enrollment.findFirst({ where: { studentMembershipId: mem!.id, groupId } });
    expect(enroll).not.toBeNull();
    
    inviteFresh = await db.inviteCode.findUnique({ where: { id: invite.id } });
    expect(inviteFresh?.usesCount).toBe(1);
    
    const pendFresh = await db.pendingInvite.findUnique({ where: { id: pending.id } });
    expect(pendFresh?.status).toBe("ACCEPTED");

    // Clean up pending invite to not affect others
    await db.pendingInvite.delete({ where: { id: pending.id } });
    await db.enrollment.deleteMany({ where: { studentMembershipId: mem!.id } });
    await db.centerMembership.delete({ where: { id: mem!.id } });
  });

  it("Other user gets 403 and nothing changes", async () => {
    const invite = await db.inviteCode.create({
      data: {
        code: `INV-${Date.now()}`, centerId, targetRole: "STUDENT", maxUses: 1,
        createdByMembershipId: (await db.centerMembership.findFirst({ where: { userId: ownerId } }))!.id,
      }
    });
    const pending = await db.pendingInvite.create({
      data: { email: targetEmail, inviteCodeId: invite.id, expiresAt: new Date(Date.now() + 100000) }
    });

    mockToken = signJWT({ userId: otherUserId, email: otherEmail, platformRole: "NONE" }, "7d", "hash2");
    const res = await acceptInvite(mockReq({ pendingInviteId: pending.id }));
    expect(res.status).toBe(403);

    const mem = await db.centerMembership.findFirst({ where: { userId: targetUserId, centerId } });
    expect(mem).toBeNull();
    const pendFresh = await db.pendingInvite.findUnique({ where: { id: pending.id } });
    expect(pendFresh?.status).toBe("PENDING");
  });

  it("Re-acceptance impossible", async () => {
    const invite = await db.inviteCode.create({
      data: {
        code: `INV-${Date.now()}`, centerId, targetRole: "STUDENT", maxUses: 5,
        createdByMembershipId: (await db.centerMembership.findFirst({ where: { userId: ownerId } }))!.id,
      }
    });
    const pending = await db.pendingInvite.create({
      data: { email: targetEmail, inviteCodeId: invite.id, expiresAt: new Date(Date.now() + 100000) }
    });

    mockToken = signJWT({ userId: targetUserId, email: targetEmail, platformRole: "NONE" }, "7d", "hash1");
    await acceptInvite(mockReq({ pendingInviteId: pending.id }));
    const res2 = await acceptInvite(mockReq({ pendingInviteId: pending.id }));
    expect(res2.status).toBe(400); // Invite already processed
  });

  it("Expired PendingInvite rejected", async () => {
    const invite = await db.inviteCode.create({
      data: {
        code: `INV-${Date.now()}`, centerId, targetRole: "STUDENT", maxUses: 5,
        createdByMembershipId: (await db.centerMembership.findFirst({ where: { userId: ownerId } }))!.id,
      }
    });
    const pending = await db.pendingInvite.create({
      data: { email: targetEmail, inviteCodeId: invite.id, expiresAt: new Date(Date.now() - 100000) }
    });

    mockToken = signJWT({ userId: targetUserId, email: targetEmail, platformRole: "NONE" }, "7d", "hash1");
    const res = await acceptInvite(mockReq({ pendingInviteId: pending.id }));
    expect(res.status).toBe(400);
  });

  it("Code exhausted at acceptance time is rejected", async () => {
    const invite = await db.inviteCode.create({
      data: {
        code: `INV-${Date.now()}`, centerId, targetRole: "STUDENT", maxUses: 1,
        createdByMembershipId: (await db.centerMembership.findFirst({ where: { userId: ownerId } }))!.id,
        usesCount: 1, // already exhausted by someone else
      }
    });
    const pending = await db.pendingInvite.create({
      data: { email: targetEmail, inviteCodeId: invite.id, expiresAt: new Date(Date.now() + 100000) }
    });

    mockToken = signJWT({ userId: targetUserId, email: targetEmail, platformRole: "NONE" }, "7d", "hash1");
    const res = await acceptInvite(mockReq({ pendingInviteId: pending.id }));
    expect(res.status).toBe(400); // Should be rejected because usesCount >= maxUses
  });

  it("Promise.all of 5 acceptances with limit 1 gives exactly 1 membership", async () => {
    const invite = await db.inviteCode.create({
      data: {
        code: `INV-${Date.now()}`, centerId, targetRole: "STUDENT", maxUses: 1,
        createdByMembershipId: (await db.centerMembership.findFirst({ where: { userId: ownerId } }))!.id,
      }
    });

    // Create 5 different pending invites for this invite code, for the same user (or different users, but same user is easier to test concurrent)
    const pendings = [];
    for (let i = 0; i < 5; i++) {
      const pending = await db.pendingInvite.create({
        data: { email: targetEmail, inviteCodeId: invite.id, expiresAt: new Date(Date.now() + 100000) }
      });
      pendings.push(pending);
    }

    mockToken = signJWT({ userId: targetUserId, email: targetEmail, platformRole: "NONE" }, "7d", "hash1");
    const promises = pendings.map(p => acceptInvite(mockReq({ pendingInviteId: p.id })));
    const results = await Promise.all(promises);

    const statuses = results.map(r => r.status);
    expect(statuses.filter(s => s === 200).length).toBe(1);
    expect(statuses.filter(s => s === 400).length).toBe(4);

    const inviteFresh = await db.inviteCode.findUnique({ where: { id: invite.id } });
    expect(inviteFresh?.usesCount).toBe(1);
  });
});

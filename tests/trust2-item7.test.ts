import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { requireTenantAccess } from "../src/lib/tenant";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

describe("TRUST-2 Item 7: requireTenantAccess PAUSED blocking, DB membership check, and Error classes", () => {
  let pausedCenterId: string;
  let activeCenterId: string;
  let directorUserId: string;
  let inactiveMemberUserId: string;

  beforeAll(async () => {
    const directorUser = await db.platformUser.create({
      data: { email: `director-${Date.now()}@t2i7.com`, passwordHash: "x", fullName: "Director User" },
    });
    directorUserId = directorUser.id;

    const pausedCenter = await db.learningCenter.create({
      data: { name: "Paused Center", slug: `pc-${Date.now()}`, ownerId: directorUser.id, status: "PAUSED" },
    });
    pausedCenterId = pausedCenter.id;

    await db.centerMembership.create({
      data: { userId: directorUser.id, centerId: pausedCenterId, role: "DIRECTOR", status: "ACTIVE" },
    });

    const activeCenter = await db.learningCenter.create({
      data: { name: "Active Center", slug: `ac-${Date.now()}`, ownerId: directorUser.id, status: "ACTIVE" },
    });
    activeCenterId = activeCenter.id;

    const inactiveUser = await db.platformUser.create({
      data: { email: `inact-${Date.now()}@t2i7.com`, passwordHash: "x", fullName: "Inactive User" },
    });
    inactiveMemberUserId = inactiveUser.id;

    await db.centerMembership.create({
      data: { userId: inactiveUser.id, centerId: activeCenterId, role: "STUDENT", status: "BLOCKED" },
    });
  });

  afterAll(async () => {
    await db.centerMembership.deleteMany({ where: { centerId: { in: [pausedCenterId, activeCenterId] } } });
    await db.learningCenter.deleteMany({ where: { id: { in: [pausedCenterId, activeCenterId] } } });
    await db.platformUser.deleteMany({
      where: { id: { in: [directorUserId, inactiveMemberUserId] } },
    });
  });

  it("PAUSED blocks DIRECTOR by default", async () => {
    mockToken = signJWT({ userId: directorUserId, email: "dir@t2i7.com", platformRole: "NONE" });
    await expect(requireTenantAccess(pausedCenterId)).rejects.toMatchObject({
      status: 403,
      code: "CENTER_SUSPENDED",
    });
  });

  it("PAUSED allows access when allowSuspended is true (resume / status read page)", async () => {
    mockToken = signJWT({ userId: directorUserId, email: "dir@t2i7.com", platformRole: "NONE" });
    const ctx = await requireTenantAccess(pausedCenterId, { allowSuspended: true });
    expect(ctx.center.id).toBe(pausedCenterId);
    expect(ctx.role).toBe("DIRECTOR");
  });

  it("checks membership from DB: rejects if DB membership status is not ACTIVE", async () => {
    // JWT has token, but DB membership status is BLOCKED
    mockToken = signJWT({ userId: inactiveMemberUserId, email: "inact@t2i7.com", platformRole: "NONE" });
    await expect(requireTenantAccess(activeCenterId)).rejects.toMatchObject({
      status: 403,
      code: "MEMBERSHIP_INACTIVE",
    });
  });
});

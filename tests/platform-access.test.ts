import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { GET as getAnalytics } from "../src/app/api/platform/analytics/route";
import { GET as getHealth } from "../src/app/api/developer/health/route";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

describe("Phase 11: Platform & Developer Access Security", () => {
  let studentUserId: string;
  let ownerUserId: string;
  let platformAdminId: string;
  let developerId: string;
  let tenantId: string;

  beforeAll(async () => {
    const pAdmin = await db.platformUser.create({ data: { email: `padmin-${Date.now()}@test.com`, passwordHash: "x", fullName: "Platform Admin", platformRole: "PLATFORM_ADMIN" } });
    platformAdminId = pAdmin.id;

    const dev = await db.platformUser.create({ data: { email: `dev-${Date.now()}@test.com`, passwordHash: "x", fullName: "Developer", platformRole: "DEVELOPER" } });
    developerId = dev.id;

    const owner = await db.platformUser.create({ data: { email: `owner-${Date.now()}@test.com`, passwordHash: "x", fullName: "Center Owner" } });
    ownerUserId = owner.id;

    const c = await db.learningCenter.create({ data: { name: "Test Center", slug: `tc-${Date.now()}`, ownerId: owner.id, status: "ACTIVE" } });
    tenantId = c.id;
    await db.centerMembership.create({ data: { userId: owner.id, centerId: tenantId, role: "DIRECTOR" } });

    const student = await db.platformUser.create({ data: { email: `stud-${Date.now()}@test.com`, passwordHash: "x", fullName: "Student" } });
    studentUserId = student.id;
    await db.centerMembership.create({ data: { userId: student.id, centerId: tenantId, role: "STUDENT" } });
  });

  afterAll(async () => {
    await db.learningCenter.deleteMany({ where: { id: tenantId } });
    await db.platformUser.deleteMany({ where: { id: { in: [platformAdminId, developerId, ownerUserId, studentUserId] } } });
  });

  const setAuth = (userId: string, platformRole: string) => {
    mockToken = signJWT({ userId, email: "test@test.com", platformRole });
  };

  const mockRequest = (url: string) => new Request(`http://localhost${url}`);

  it("DENY: Student cannot access Platform Analytics", async () => {
    setAuth(studentUserId, "NONE");
    const req = mockRequest(`/api/platform/analytics`);
    const res = await getAnalytics();
    expect(res.status).toBe(403);
  });

  it("DENY: Center Owner cannot access Platform Analytics", async () => {
    setAuth(ownerUserId, "NONE");
    const req = mockRequest(`/api/platform/analytics`);
    const res = await getAnalytics();
    expect(res.status).toBe(403);
  });

  it("ALLOW: Platform Admin can access Platform Analytics", async () => {
    setAuth(platformAdminId, "PLATFORM_ADMIN");
    const req = mockRequest(`/api/platform/analytics`);
    const res = await getAnalytics();
    expect(res.status).toBe(200);
  });

  it("DENY: Platform Admin cannot access Developer Health", async () => {
    setAuth(platformAdminId, "PLATFORM_ADMIN");
    const req = mockRequest(`/api/developer/health`);
    const res = await getHealth();
    expect(res.status).toBe(403);
  });

  it("ALLOW: Developer can access Developer Health", async () => {
    setAuth(developerId, "DEVELOPER");
    const req = mockRequest(`/api/developer/health`);
    const res = await getHealth();
    expect(res.status).toBe(200);
  });

  it("CRITICAL: Tenant Isolation - Center Owner cannot see another center's tickets", async () => {
    // Create a mock GET function for tickets
    const { GET: getTickets } = await import("../src/app/api/tickets/route");
    
    // Create a ticket for a completely different user/center
    const otherUser = await db.platformUser.create({ data: { email: `other-${Date.now()}@test.com`, passwordHash: "x", fullName: "Other" } });
    const otherCenter = await db.learningCenter.create({ data: { name: "Other Center", slug: `oc-${Date.now()}`, ownerId: otherUser.id, status: "ACTIVE" } });
    const ticket = await db.supportTicket.create({
      data: {
        creatorUserId: otherUser.id,
        centerId: otherCenter.id,
        subject: "Secret Ticket",
        status: "OPEN",
        scope: "TENANT",
      }
    });

    // Owner tries to fetch their tickets
    setAuth(ownerUserId, "NONE");
    const res = await getTickets(mockRequest(`/api/tickets`));
    const json = (await res.json()) as { tickets?: { id: string }[] };
    
    // Should not contain the other ticket
    const found = json.tickets?.some((t: { id: string }) => t.id === ticket.id);
    expect(found).toBe(false);
  });
});

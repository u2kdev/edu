import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { GET as getTickets } from "../src/app/api/tickets/route";
import { GET as getTicketId, PATCH as patchTicketId } from "../src/app/api/tickets/[id]/route";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";

let mockToken = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
  }),
}));

describe("Platform Support Tickets IDOR Check", () => {
  let userA: string;
  let userB: string;
  let ticketB: string;
  let centerA: string;

  beforeAll(async () => {
    const uA = await db.platformUser.create({ data: { email: `ticketA-${Date.now()}@test.com`, passwordHash: "x", fullName: "Test A" } });
    userA = uA.id;
    
    const cA = await db.learningCenter.create({
      data: { name: "Center A", slug: `c-a-${Date.now()}`, ownerId: userA, status: "ACTIVE" }
    });
    centerA = cA.id;
    
    const uB = await db.platformUser.create({ data: { email: `ticketB-${Date.now()}@test.com`, passwordHash: "x", fullName: "Test B" } });
    userB = uB.id;

    const tB = await db.supportTicket.create({
      data: { creatorUserId: userB, subject: "Hello", status: "OPEN" }
    });
    ticketB = tB.id;
  });

  afterAll(async () => {
    await db.supportTicket.deleteMany({ where: { creatorUserId: { in: [userA, userB] } } });
    await db.learningCenter.delete({ where: { id: centerA } });
    await db.platformUser.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  const mockReq = (url: string, method = "GET", body?: any) => 
    new Request(`http://localhost${url}`, { method, body: body ? JSON.stringify(body) : undefined });

  it("User A cannot view User B ticket in the list", async () => {
    mockToken = signJWT({ userId: userA, email: "a", platformRole: "NONE", activeCenterId: centerA, activeCenterRole: "DIRECTOR" });
    const res = await getTickets(mockReq(`/api/tickets`));
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.tickets.some((t: any) => t.id === ticketB)).toBe(false);
  });

  it("User A cannot view User B ticket by ID (GET)", async () => {
    mockToken = signJWT({ userId: userA, email: "a", platformRole: "NONE", activeCenterId: centerA, activeCenterRole: "DIRECTOR" });
    const res = await getTicketId(mockReq(`/api/tickets/${ticketB}`), { params: { id: ticketB } });
    expect(res.status).toBe(403);
  });

  it("User A cannot modify User B ticket by ID (PATCH)", async () => {
    mockToken = signJWT({ userId: userA, email: "a", platformRole: "NONE", activeCenterId: centerA, activeCenterRole: "DIRECTOR" });
    const res = await patchTicketId(mockReq(`/api/tickets/${ticketB}`, "PATCH", { status: "CLOSED" }), { params: { id: ticketB } });
    expect(res.status).toBe(403);

    // Verify it wasn't modified
    const check = await db.supportTicket.findUnique({ where: { id: ticketB } });
    expect(check?.status).toBe("OPEN");
  });
});

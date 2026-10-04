import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { GET as getTickets } from "../src/app/api/tickets/route";
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

  beforeAll(async () => {
    const uA = await db.platformUser.create({ data: { email: `ticketA-${Date.now()}@test.com`, passwordHash: "x", fullName: "Test A" } });
    userA = uA.id;
    
    const uB = await db.platformUser.create({ data: { email: `ticketB-${Date.now()}@test.com`, passwordHash: "x", fullName: "Test B" } });
    userB = uB.id;

    const tB = await db.supportTicket.create({
      data: { creatorUserId: userB, subject: "Hello", status: "OPEN" }
    });
    ticketB = tB.id;
  });

  afterAll(async () => {
    await db.supportTicket.deleteMany({ where: { creatorUserId: { in: [userA, userB] } } });
    await db.platformUser.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  const mockReq = (url: string) => new Request(`http://localhost${url}`);

  it("User A cannot view User B ticket in the list", async () => {
    const { hashJti } = await import("../src/lib/auth");
    await db.userSession.create({
      data: { userId: userA, jtiHash: hashJti("jti_ticket"), expiresAt: new Date(Date.now() + 10000) }
    });
    mockToken = signJWT({ userId: userA, email: "a", platformRole: "NONE" }, "7d", "jti_ticket");
    
    const res = await getTickets(mockReq(`/api/tickets`));
    const data = await res.json();
    
    expect(res.status).toBe(200);
    // Ticket B shouldn't be here since User A isn't in any center and it's not their ticket
    expect(data.tickets.some((t: any) => t.id === ticketB)).toBe(false);
  });
});

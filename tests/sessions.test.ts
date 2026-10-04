import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { GET as getSessions, DELETE as deleteSession } from "../src/app/api/auth/sessions/route";
import { db } from "../src/lib/db";
import { signJWT, hashJti } from "../src/lib/auth";

let mockToken = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
  }),
}));

describe("User Sessions API", () => {
  let user: string;
  let session1: string;
  let session2: string;

  beforeAll(async () => {
    const u = await db.platformUser.create({ data: { email: `sessions-${Date.now()}@test.com`, passwordHash: "x", fullName: "Test" } });
    user = u.id;

    // Create 2 sessions
    const s1 = await db.userSession.create({
      data: { userId: user, jtiHash: hashJti("jti1"), expiresAt: new Date(Date.now() + 100000), ipAddress: "1.1.1.1", userAgent: "Browser 1" }
    });
    session1 = s1.id;

    const s2 = await db.userSession.create({
      data: { userId: user, jtiHash: hashJti("jti2"), expiresAt: new Date(Date.now() + 100000), ipAddress: "2.2.2.2", userAgent: "Browser 2" }
    });
    session2 = s2.id;
  });

  afterAll(async () => {
    await db.userSession.deleteMany({ where: { userId: user } });
    await db.platformUser.deleteMany({ where: { id: user } });
  });

  const mockReq = (url: string) => new Request(`http://localhost${url}`);

  it("should list active sessions", async () => {
    mockToken = signJWT({ userId: user, email: "test", platformRole: "NONE" }, "7d", "jti1");
    const res = await getSessions(mockReq("/api/auth/sessions"));
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.sessions.length).toBe(2);
    
    const curr = data.sessions.find((s: any) => s.isCurrent);
    expect(curr.id).toBe(session1);
  });

  it("should revoke a specific session", async () => {
    mockToken = signJWT({ userId: user, email: "test", platformRole: "NONE" }, "7d", "jti1");
    const res = await deleteSession(mockReq(`/api/auth/sessions?id=${session2}`));
    expect(res.status).toBe(200);

    const s2Check = await db.userSession.findUnique({ where: { id: session2 } });
    expect(s2Check?.revokedAt).not.toBeNull();
  });

  it("should revoke all but current", async () => {
    const s3 = await db.userSession.create({
      data: { userId: user, jtiHash: hashJti("jti3"), expiresAt: new Date(Date.now() + 100000), ipAddress: "3.3.3.3" }
    });
    
    mockToken = signJWT({ userId: user, email: "test", platformRole: "NONE" }, "7d", "jti1");
    const res = await deleteSession(mockReq(`/api/auth/sessions?allButCurrent=true`));
    expect(res.status).toBe(200);

    const check1 = await db.userSession.findUnique({ where: { id: session1 } });
    expect(check1?.revokedAt).toBeNull(); // Current
    
    const check3 = await db.userSession.findUnique({ where: { id: s3.id } });
    expect(check3?.revokedAt).not.toBeNull(); // Revoked
  });
});

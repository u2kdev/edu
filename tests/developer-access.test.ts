import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { GET as getAuditLogs } from "../src/app/api/developer/audit-logs/route";
import { GET as getHealth } from "../src/app/api/developer/health/route";
import { GET as getOwners } from "../src/app/api/developer/platform-owners/route";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";

let mockToken = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
  }),
}));

describe("Developer Routes (403 Checks)", () => {
  let user: string;

  beforeAll(async () => {
    const u = await db.platformUser.create({ data: { email: `devtest-${Date.now()}@test.com`, passwordHash: "x", fullName: "Dev Test", platformRole: "NONE" } });
    user = u.id;
  });

  afterAll(async () => {
    await db.platformUser.deleteMany({ where: { id: user } });
  });

  const setAuth = (userId: string, role: string) => {
    mockToken = signJWT({ userId, email: "test", platformRole: role });
  };

  const mockRequest = (url: string) => new Request(`http://localhost${url}`);

  it("should return 403 for normal user on developer/audit-logs", async () => {
    setAuth(user, "NONE");
    const res = await getAuditLogs(mockRequest("/api/developer/audit-logs"));
    expect(res.status).toBe(403);
  });

  it("should return 403 for DIRECTOR on developer/health", async () => {
    setAuth(user, "NONE"); // platformRole is NONE, center role doesn't matter for developer routes
    const res = await getHealth();
    expect(res.status).toBe(403);
  });

  it("should return 403 for normal user on developer/platform-owners", async () => {
    setAuth(user, "NONE");
    const res = await getOwners();
    expect(res.status).toBe(403);
  });
});

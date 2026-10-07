import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { GET as getCenters, POST as postCenter } from "../src/app/api/platform/centers/route";
import { POST as suspendCenter } from "../src/app/api/platform/centers/[id]/suspend/route";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

describe("Organizations Role Matrix", () => {
  let superAdminId: string;
  let platformAdminId: string;
  let platformSupportId: string;

  beforeAll(async () => {
    const sa = await db.platformUser.create({ data: { email: `sa-${Date.now()}@test.com`, passwordHash: "x", fullName: "Super Admin", platformRole: "SUPERADMIN" } });
    superAdminId = sa.id;

    const pa = await db.platformUser.create({ data: { email: `pa-${Date.now()}@test.com`, passwordHash: "x", fullName: "Platform Admin", platformRole: "PLATFORM_ADMIN" } });
    platformAdminId = pa.id;

    const ps = await db.platformUser.create({ data: { email: `ps-${Date.now()}@test.com`, passwordHash: "x", fullName: "Platform Support", platformRole: "PLATFORM_SUPPORT" } });
    platformSupportId = ps.id;
  });

  afterAll(async () => {
    await db.platformUser.deleteMany({ where: { id: { in: [superAdminId, platformAdminId, platformSupportId] } } });
  });

  const setAuth = (userId: string, platformRole: string) => {
    mockToken = signJWT({ userId, email: "test@test.com", platformRole });
  };

  const mockRequest = (url: string, method = "GET", body?: any) => {
    return new Request(`http://localhost${url}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  describe("STEP 1: Permissions (Role Matrix)", () => {
    it("ALLOW: SUPERADMIN can access centers list", async () => {
      setAuth(superAdminId, "SUPERADMIN");
      const res = await getCenters(mockRequest("/api/platform/centers"));
      expect(res.status).toBe(200);
    });

    it("ALLOW: PLATFORM_ADMIN can access centers list", async () => {
      setAuth(platformAdminId, "PLATFORM_ADMIN");
      const res = await getCenters(mockRequest("/api/platform/centers"));
      expect(res.status).toBe(200);
    });

    it("ALLOW: PLATFORM_SUPPORT can access centers list (read-only)", async () => {
      setAuth(platformSupportId, "PLATFORM_SUPPORT");
      const res = await getCenters(mockRequest("/api/platform/centers"));
      expect(res.status).toBe(200);
    });

    it("DENY: PLATFORM_SUPPORT cannot create center", async () => {
      setAuth(platformSupportId, "PLATFORM_SUPPORT");
      const res = await postCenter(mockRequest("/api/platform/centers", "POST", { name: "test", slug: "test", directorEmail: "test@test.com", directorFullName: "test" }));
      expect(res.status).toBe(403);
    });

    it("ALLOW: PLATFORM_ADMIN can create center (returns 400 for bad data, not 403)", async () => {
      setAuth(platformAdminId, "PLATFORM_ADMIN");
      const res = await postCenter(mockRequest("/api/platform/centers", "POST", {}));
      expect(res.status).toBe(400); // Because it passed permission check and failed validation
    });

    it("DENY: PLATFORM_SUPPORT cannot block center", async () => {
      setAuth(platformSupportId, "PLATFORM_SUPPORT");
      const res = await suspendCenter(mockRequest("/api/platform/centers/123/suspend", "POST", { action: "block", reason: "test reason" }), { params: { id: "123" } });
      expect(res.status).toBe(403);
    });
  });
});

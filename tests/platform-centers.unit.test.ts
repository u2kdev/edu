import { describe, it, expect, vi, beforeEach } from "vitest";

// mock db
vi.mock("@/lib/db", () => {
  return {
    db: {
      learningCenter: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      platformUser: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      centerMembership: {
        create: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      passwordResetToken: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      subscriptionPlan: {
        findFirst: vi.fn(),
      },
      subscription: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        return cb({
          platformUser: {
            findUnique: vi.fn().mockResolvedValue({ id: "user1", email: "test@test.com" }),
            create: vi.fn().mockResolvedValue({ id: "user1", email: "test@test.com" }),
          },
          learningCenter: {
            create: vi.fn().mockResolvedValue({ id: "center1", slug: "test" }),
            update: vi.fn(),
          },
          subscriptionPlan: {
            findFirst: vi.fn(),
          },
          subscription: {
            create: vi.fn(),
          },
          centerMembership: {
            create: vi.fn(),
            updateMany: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
          },
          passwordResetToken: {
            create: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          }
        });
      })
    }
  };
});

let mockSession = { user: { id: "user1", platformRole: "SUPERADMIN" } };
vi.mock("@/lib/auth", () => {
  return {
    getAuthSession: vi.fn(() => Promise.resolve(mockSession)),
  };
});

vi.mock("@/lib/permissions", () => {
  return {
    hasPermission: vi.fn((perm, role) => {
      if (role === "NONE") return false;
      return true;
    }),
  };
});

vi.mock("@/lib/rate-limit", () => {
  return {
    checkRateLimit: vi.fn(() => true),
    getClientIp: vi.fn(() => "127.0.0.1"),
  };
});

import { GET as getCenters, POST as createCenter } from "@/app/api/platform/centers/route";
import { GET as getCenter, PATCH as patchCenter } from "@/app/api/platform/centers/[id]/route";
import { POST as changeDirector } from "@/app/api/platform/centers/[id]/director/route";
import { POST as suspendCenter } from "@/app/api/platform/centers/[id]/suspend/route";
import { db } from "@/lib/db";

describe("Platform Centers API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { user: { id: "user1", platformRole: "SUPERADMIN" } };
  });

  describe("GET /api/platform/centers", () => {
    it("returns 403 if no permission", async () => {
      mockSession = { user: { id: "user2", platformRole: "NONE" } };
      const req = new Request("http://localhost/api/platform/centers?page=1&pageSize=10");
      const res = await getCenters(req);
      expect(res.status).toBe(403);
    });

    it("returns centers with pagination", async () => {
      vi.mocked(db.learningCenter.findMany).mockResolvedValueOnce([{ id: "1" }] as never);
      vi.mocked(db.learningCenter.count).mockResolvedValueOnce(1);
      
      const req = new Request("http://localhost/api/platform/centers?page=1&pageSize=10");
      const res = await getCenters(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items).toHaveLength(1);
      expect(json.total).toBe(1);
    });
  });

  describe("POST /api/platform/centers", () => {
    it("validates body and prevents reserved slugs", async () => {
      const req = new Request("http://localhost/api/platform/centers", {
        method: "POST",
        body: JSON.stringify({
          name: "Test",
          slug: "admin",
          directorEmail: "d@d.com",
          directorFullName: "Director"
        })
      });
      const res = await createCenter(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Reserved slug");
    });

    it("creates a center successfully", async () => {
      vi.mocked(db.learningCenter.findUnique).mockResolvedValueOnce(null); // slug available
      const req = new Request("http://localhost/api/platform/centers", {
        method: "POST",
        headers: {
          "x-forwarded-for": "1.2.3.4"
        },
        body: JSON.stringify({
          name: "Test",
          slug: "test-center",
          directorEmail: "d@d.com",
          directorFullName: "Director",
          contacts: { phone: "123" },
          timeZone: "Asia/Tashkent"
        })
      });
      const res = await createCenter(req);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/platform/centers/[id]", () => {
    it("returns center data", async () => {
      vi.mocked(db.learningCenter.findUnique).mockResolvedValueOnce({ id: "center1", owner: {} } as never);
      const req = new Request("http://localhost/api/platform/centers/center1");
      const res = await getCenter(req, { params: { id: "center1" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe("center1");
    });
  });

  describe("PATCH /api/platform/centers/[id]", () => {
    it("updates center data", async () => {
      vi.mocked(db.learningCenter.findUnique).mockResolvedValueOnce({ id: "center1" } as never);
      vi.mocked(db.learningCenter.update).mockResolvedValueOnce({ id: "center1", name: "New" } as never);

      const req = new Request("http://localhost/api/platform/centers/center1", {
        method: "PATCH",
        body: JSON.stringify({ name: "New" })
      });
      const res = await patchCenter(req, { params: { id: "center1" } });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/platform/centers/[id]/director", () => {
    it("changes director", async () => {
      vi.mocked(db.learningCenter.findUnique).mockResolvedValueOnce({ id: "center1", ownerId: "old" } as never);
      const req = new Request("http://localhost/api/platform/centers/center1/director", {
        method: "POST",
        body: JSON.stringify({ email: "new@new.com" })
      });
      const res = await changeDirector(req, { params: { id: "center1" } });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/platform/centers/[id]/suspend", () => {
    it("requires reason for pause", async () => {
      const req = new Request("http://localhost/api/platform/centers/center1/suspend", {
        method: "POST",
        body: JSON.stringify({ action: "pause" })
      });
      const res = await suspendCenter(req, { params: { id: "center1" } });
      expect(res.status).toBe(400);
    });

    it("suspends center", async () => {
      vi.mocked(db.learningCenter.findUnique).mockResolvedValueOnce({ id: "center1" } as never);
      const req = new Request("http://localhost/api/platform/centers/center1/suspend", {
        method: "POST",
        body: JSON.stringify({ action: "pause", reason: "testing" })
      });
      const res = await suspendCenter(req, { params: { id: "center1" } });
      expect(res.status).toBe(200);
    });
  });
});

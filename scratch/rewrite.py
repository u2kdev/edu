import os
import json
import re

route_ts_content = """import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";
import crypto from "crypto";

const getQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  q: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(["createdAt", "name"]).default("createdAt"),
});

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.read", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const parsedParams = getQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsedParams.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    const { page, pageSize, q, status, sortBy } = parsedParams.data;

    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { slug: { contains: q } },
        { owner: { email: { contains: q } } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      db.learningCenter.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: "desc" },
        include: {
          owner: { select: { id: true, email: true, fullName: true } }
        }
      }),
      db.learningCenter.count({ where }),
    ]);

    return NextResponse.json({ items, total });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

const postBodySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  contacts: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
  timeZone: z.string().default("Asia/Tashkent"),
  status: z.string().default("TRIAL"),
  trialEndsAt: z.string().optional(),
  directorEmail: z.string().email(),
  directorFullName: z.string().min(2),
});

const RESERVED_SLUGS = ["admin", "api", "platform", "login", "auth", "system"];

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(ip, 5, 60000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsedBody = postBodySchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.errors }, { status: 400 });
    }

    const data = parsedBody.data;

    if (RESERVED_SLUGS.includes(data.slug.toLowerCase())) {
      return NextResponse.json({ error: "Reserved slug" }, { status: 400 });
    }

    const existingSlug = await db.learningCenter.findUnique({
      where: { slug: data.slug.toLowerCase() },
    });

    if (existingSlug) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      let user = await tx.platformUser.findUnique({
        where: { email: data.directorEmail.toLowerCase().trim() },
      });

      if (!user) {
        const randomPassword = crypto.randomBytes(16).toString("hex");
        user = await tx.platformUser.create({
          data: {
            email: data.directorEmail.toLowerCase().trim(),
            fullName: data.directorFullName,
            passwordHash: randomPassword,
            emailVerified: new Date(),
          },
        });
      }

      const center = await tx.learningCenter.create({
        data: {
          name: data.name,
          slug: data.slug.toLowerCase(),
          email: data.contacts?.email,
          phone: data.contacts?.phone,
          timeZone: data.timeZone,
          status: data.status,
          ownerId: user.id,
        },
      });

      if (data.trialEndsAt) {
        const plan = await tx.subscriptionPlan.findFirst({ where: { isActive: true } });
        if (plan) {
            await tx.subscription.create({
              data: {
                centerId: center.id,
                planId: plan.id,
                status: "TRIAL",
                trialEndsAt: new Date(data.trialEndsAt),
                currentPeriodStartsAt: new Date(),
                currentPeriodEndsAt: new Date(data.trialEndsAt),
              }
            });
        }
      }

      await tx.centerMembership.create({
        data: {
          userId: user.id,
          centerId: center.id,
          role: "DIRECTOR",
        },
      });

      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashedToken,
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
        },
      });

      // Mock sending email
      console.log(`Sending email to ${user.email} with reset token`);

      await tx.auditLog.create({
        data: {
          centerId: center.id,
          actorUserId: session.user.id,
          action: "PLATFORM_CREATE_LEARNING_CENTER",
          resource: "LearningCenter",
          detailsJson: JSON.stringify({ slug: center.slug }),
        },
      });

      return { center, user };
    });

    return NextResponse.json({ success: true, center: result.center });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
"""

with open("D:/AZIZ PROJECT/src/app/api/platform/centers/route.ts", "w", encoding="utf-8") as f:
    f.write(route_ts_content)

id_route_ts_content = """import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.read", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const center = await db.learningCenter.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, email: true, fullName: true } }
      }
    });

    if (!center) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const membersGrouped = await db.centerMembership.groupBy({
      by: ["role"],
      where: { centerId: params.id },
      _count: { id: true }
    });

    const metrics = {
      usersByRole: membersGrouped.reduce((acc, curr) => {
        acc[curr.role] = curr._count.id;
        return acc;
      }, {} as Record<string, number>)
    };

    const auditLogs = await db.auditLog.findMany({
      where: { centerId: params.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ data: center, director: center.owner, metrics, auditLogs });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  timeZone: z.string().optional(),
  brandingConfig: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsedBody = patchSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.errors }, { status: 400 });
    }

    const existing = await db.learningCenter.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await db.learningCenter.update({
      where: { id: params.id },
      data: parsedBody.data,
    });

    const before = {
      name: existing.name,
      phone: existing.phone,
      email: existing.email,
      timeZone: existing.timeZone,
      brandingConfig: existing.brandingConfig
    };
    const after = {
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      timeZone: updated.timeZone,
      brandingConfig: updated.brandingConfig
    };

    await db.auditLog.create({
      data: {
        centerId: params.id,
        actorUserId: session.user.id,
        action: "PLATFORM_UPDATE_LEARNING_CENTER",
        resource: "LearningCenter",
        detailsJson: JSON.stringify({ before, after }),
      },
    });

    return NextResponse.json({ success: true, center: updated });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
"""

os.makedirs("D:/AZIZ PROJECT/src/app/api/platform/centers/[id]", exist_ok=True)
with open("D:/AZIZ PROJECT/src/app/api/platform/centers/[id]/route.ts", "w", encoding="utf-8") as f:
    f.write(id_route_ts_content)

director_route_ts = """import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import crypto from "crypto";

const schema = z.object({
  email: z.string().email()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const targetEmail = parsed.data.email.toLowerCase().trim();

    const center = await db.learningCenter.findUnique({
      where: { id: params.id }
    });
    if (!center) {
      return NextResponse.json({ error: "Center not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      let user = await tx.platformUser.findUnique({ where: { email: targetEmail } });
      if (!user) {
        user = await tx.platformUser.create({
          data: {
            email: targetEmail,
            fullName: "New Director",
            passwordHash: crypto.randomBytes(16).toString("hex"),
            emailVerified: new Date()
          }
        });
      }

      const oldOwnerId = center.ownerId;
      
      if (oldOwnerId !== user.id) {
        await tx.centerMembership.updateMany({
          where: { centerId: params.id, userId: oldOwnerId, role: "DIRECTOR" },
          data: { role: "CENTER_ADMIN" }
        });
      }

      const existingMembership = await tx.centerMembership.findUnique({
        where: { userId_centerId_role: { userId: user.id, centerId: params.id, role: "DIRECTOR" } }
      });
      
      if (!existingMembership) {
        const otherMembership = await tx.centerMembership.findFirst({
            where: { userId: user.id, centerId: params.id }
        });

        if (otherMembership) {
            await tx.centerMembership.update({
                where: { id: otherMembership.id },
                data: { role: "DIRECTOR" }
            });
        } else {
            await tx.centerMembership.create({
            data: { userId: user.id, centerId: params.id, role: "DIRECTOR" }
            });
        }
      }

      await tx.learningCenter.update({
        where: { id: params.id },
        data: { ownerId: user.id }
      });

      await tx.auditLog.create({
        data: {
          centerId: params.id,
          actorUserId: session.user.id,
          action: "PLATFORM_CHANGE_DIRECTOR",
          resource: "LearningCenter",
          detailsJson: JSON.stringify({ oldOwnerId, newOwnerId: user.id })
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
"""

os.makedirs("D:/AZIZ PROJECT/src/app/api/platform/centers/[id]/director", exist_ok=True)
with open("D:/AZIZ PROJECT/src/app/api/platform/centers/[id]/director/route.ts", "w", encoding="utf-8") as f:
    f.write(director_route_ts)

suspend_route_ts = """import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["pause", "block", "resume"]),
  reason: z.string().min(5).max(500).optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.block", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { action, reason } = parsed.data;

    if ((action === "pause" || action === "block") && !reason) {
      return NextResponse.json({ error: "Reason required for pause/block" }, { status: 400 });
    }

    const center = await db.learningCenter.findUnique({ where: { id: params.id } });
    if (!center) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let status = center.status;
    if (action === "pause") status = "PAUSED";
    if (action === "block") status = "BLOCKED";
    if (action === "resume") status = "ACTIVE"; 

    await db.learningCenter.update({
      where: { id: params.id },
      data: {
        status,
        suspensionReason: action === "resume" ? null : reason
      }
    });

    await db.auditLog.create({
      data: {
        centerId: params.id,
        actorUserId: session.user.id,
        action: `PLATFORM_${action.toUpperCase()}_CENTER`,
        resource: "LearningCenter",
        detailsJson: JSON.stringify({ reason })
      }
    });

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
"""

os.makedirs("D:/AZIZ PROJECT/src/app/api/platform/centers/[id]/suspend", exist_ok=True)
with open("D:/AZIZ PROJECT/src/app/api/platform/centers/[id]/suspend/route.ts", "w", encoding="utf-8") as f:
    f.write(suspend_route_ts)

test_ts = """import { describe, it, expect, vi, beforeEach } from "vitest";

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
      vi.mocked(db.learningCenter.findMany).mockResolvedValueOnce([{ id: "1" } as any]);
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
      vi.mocked(db.learningCenter.findUnique).mockResolvedValueOnce({ id: "center1", owner: {} } as any);
      const req = new Request("http://localhost/api/platform/centers/center1");
      const res = await getCenter(req, { params: { id: "center1" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe("center1");
    });
  });

  describe("PATCH /api/platform/centers/[id]", () => {
    it("updates center data", async () => {
      vi.mocked(db.learningCenter.findUnique).mockResolvedValueOnce({ id: "center1" } as any);
      vi.mocked(db.learningCenter.update).mockResolvedValueOnce({ id: "center1", name: "New" } as any);

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
      vi.mocked(db.learningCenter.findUnique).mockResolvedValueOnce({ id: "center1", ownerId: "old" } as any);
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
      vi.mocked(db.learningCenter.findUnique).mockResolvedValueOnce({ id: "center1" } as any);
      const req = new Request("http://localhost/api/platform/centers/center1/suspend", {
        method: "POST",
        body: JSON.stringify({ action: "pause", reason: "testing" })
      });
      const res = await suspendCenter(req, { params: { id: "center1" } });
      expect(res.status).toBe(200);
    });
  });
});
"""

with open("D:/AZIZ PROJECT/tests/platform-centers.test.ts", "w", encoding="utf-8") as f:
    f.write(test_ts)

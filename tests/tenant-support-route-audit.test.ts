import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import type { LearningCenter, PlatformUser } from "@prisma/client";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

function scanRouteFiles(dir: string): string[] {
  let routes: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes = routes.concat(scanRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name === "route.ts") {
      routes.push(fullPath);
    }
  }
  return routes;
}

export const EXCLUDED_ROUTES_MAP: { pattern: RegExp; route: string; reason: string }[] = [
  {
    pattern: /[\\/]api[\\/]auth[\\/]/,
    route: "api/auth/*",
    reason: "Глобальная аутентификация и управление сессиями пользователей вне тенанта",
  },
  {
    pattern: /[\\/]api[\\/]platform[\\/]/,
    route: "api/platform/*",
    reason: "Платформенное супер-администрирование (центры, тарифы, глобальные аккаунты)",
  },
  {
    pattern: /[\\/]api[\\/]developer[\\/]/,
    route: "api/developer/*",
    reason: "Инженерные маршруты разработчиков (health, системный аудит, владельцы)",
  },
  {
    pattern: /[\\/]api[\\/]tickets[\\/]/,
    route: "api/tickets/*",
    reason: "Служба технической поддержки платформы (тикеты, доступные саппорту для ответа)",
  },
  {
    pattern: /[\\/]api[\\/]notifications[\\/]/,
    route: "api/notifications",
    reason: "Личные уведомления пользователя (отметка прочитанности текущим пользователем)",
  },
  {
    pattern: /[\\/]api[\\/]invites[\\/]accept[\\/]/,
    route: "api/invites/accept",
    reason: "Пользовательский шлюз погашения инвайт-кода до входа в тенант",
  },
  {
    pattern: /[\\/]api[\\/]invites[\\/]redeem[\\/]/,
    route: "api/invites/redeem",
    reason: "Публичный шлюз регистрации по инвайту",
  },
  {
    pattern: /[\\/]api[\\/]tenant[\\/]onboarding[\\/]/,
    route: "api/tenant/onboarding",
    reason: "Создание нового учебного центра будущим владельцем",
  },
  {
    pattern: /[\\/]api[\\/]health[\\/]/,
    route: "api/health",
    reason: "Системный мониторинг доступности сервиса (только GET, без мутаций)",
  },
];

const EXCLUDED_PATTERNS = EXCLUDED_ROUTES_MAP.map((item) => item.pattern);

describe("TRUST-3b Item 3: Dynamic audit of all tenant write routes - PLATFORM_SUPPORT returns 403", () => {
  let center: LearningCenter;
  let owner: PlatformUser;
  let platformSupport: PlatformUser;
  const discoveredRoutes: { relPath: string; fullPath: string; methods: string[] }[] = [];

  beforeAll(async () => {
    const ts = Date.now();
    owner = await db.platformUser.create({
      data: { email: `owner_audit_${ts}@audit.com`, passwordHash: "x", fullName: "Owner Audit", emailVerified: new Date() },
    });
    platformSupport = await db.platformUser.create({
      data: {
        email: `ps_audit_${ts}@audit.com`,
        passwordHash: "x",
        fullName: "Platform Support Audit",
        platformRole: "PLATFORM_SUPPORT",
        emailVerified: new Date(),
      },
    });

    center = await db.learningCenter.create({
      data: { name: "Audit Center", slug: `ac-${ts}`, ownerId: owner.id, status: "ACTIVE" },
    });

    const plan = await db.subscriptionPlan.create({
      data: {
        name: `Audit Plan ${ts}`,
        priceMonthly: 10,
        maxStudents: 100,
        maxTeachers: 50,
        maxCourses: 50,
        maxBranches: 10,
      },
    });

    await db.subscription.create({
      data: {
        centerId: center.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStartsAt: new Date(),
        currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });

    await db.centerMembership.create({
      data: { userId: owner.id, centerId: center.id, role: "DIRECTOR", status: "ACTIVE" },
    });

    mockToken = signJWT({
      userId: platformSupport.id,
      email: platformSupport.email,
      platformRole: "PLATFORM_SUPPORT",
      activeCenterId: center.id,
    });

    // Dynamic scanning
    const apiDir = path.resolve(process.cwd(), "src/app/api");
    const allRoutes = scanRouteFiles(apiDir);
    const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];

    for (const routePath of allRoutes) {
      if (EXCLUDED_PATTERNS.some((p) => p.test(routePath))) {
        continue;
      }
      const relPath = path.relative(process.cwd(), routePath).replace(/\\/g, "/");
      const mod = await import(pathToFileURL(routePath).href);
      const methods = writeMethods.filter((m) => typeof mod[m] === "function");
      if (methods.length > 0) {
        discoveredRoutes.push({ relPath, fullPath: routePath, methods });
      }
    }
  });

  afterAll(async () => {
    await db.subscription.deleteMany({ where: { centerId: center.id } });
    await db.subscriptionPlan.deleteMany({ where: { name: { contains: "Audit Plan" } } });
    await db.centerMembership.deleteMany({ where: { centerId: center.id } });
    await db.learningCenter.deleteMany({ where: { slug: "illegal-center" } });
    await db.learningCenter.deleteMany({ where: { id: center.id } });
    await db.platformUser.deleteMany({ where: { email: { in: [owner.email, platformSupport.email] } } });
  });

  it("dynamic scanner discovers all tenant write routes and prints the list", () => {
    expect(discoveredRoutes.length).toBeGreaterThanOrEqual(15);
    console.log("=== Discovered Tenant Write Routes for Dynamic Audit ===");
    for (const r of discoveredRoutes) {
      console.log(`- ${r.relPath}: [${r.methods.join(", ")}]`);
    }
  });

  it("POST /api/center-payments returns 403 for PLATFORM_SUPPORT", async () => {
    const { POST } = await import("../src/app/api/center-payments/route");
    const req = new Request(`http://localhost/api/center-payments?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 100 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("PATCH /api/center-payments returns 403 for PLATFORM_SUPPORT", async () => {
    const { PATCH } = await import("../src/app/api/center-payments/route");
    const req = new Request(`http://localhost/api/center-payments?centerId=${center.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: "dummy" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/attendance/bulk returns 403 for PLATFORM_SUPPORT", async () => {
    const { POST } = await import("../src/app/api/attendance/bulk/route");
    const req = new Request(`http://localhost/api/attendance/bulk?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: "dummy", groupId: "dummy" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/groups returns 403 for PLATFORM_SUPPORT", async () => {
    const { POST } = await import("../src/app/api/groups/route");
    const req = new Request(`http://localhost/api/groups?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Audit Group" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/homework returns 403 for PLATFORM_SUPPORT", async () => {
    const { POST } = await import("../src/app/api/homework/route");
    const req = new Request(`http://localhost/api/homework?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "HW" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("PATCH /api/grades returns 403 for PLATFORM_SUPPORT", async () => {
    const { PATCH } = await import("../src/app/api/grades/route");
    const req = new Request(`http://localhost/api/grades?centerId=${center.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "dummy" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it("DELETE /api/grades returns 403 for PLATFORM_SUPPORT", async () => {
    const { DELETE } = await import("../src/app/api/grades/route");
    const req = new Request(`http://localhost/api/grades?centerId=${center.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "dummy" }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/announcements returns 403 for PLATFORM_SUPPORT", async () => {
    const { POST } = await import("../src/app/api/tenant/announcements/route");
    const req = new Request(`http://localhost/api/tenant/announcements?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "A" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/branches returns 403 for PLATFORM_SUPPORT", async () => {
    const { POST } = await import("../src/app/api/tenant/branches/route");
    const req = new Request(`http://localhost/api/tenant/branches?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "B" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/schedule returns 403 for PLATFORM_SUPPORT", async () => {
    const { POST } = await import("../src/app/api/tenant/schedule/route");
    const req = new Request(`http://localhost/api/tenant/schedule?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/staff returns 403 for PLATFORM_SUPPORT", async () => {
    const { POST } = await import("../src/app/api/tenant/staff/route");
    const req = new Request(`http://localhost/api/tenant/staff?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "staff@test.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/subjects returns 403 for PLATFORM_SUPPORT", async () => {
    const { POST } = await import("../src/app/api/tenant/subjects/route");
    const req = new Request(`http://localhost/api/tenant/subjects?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sub" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("all dynamically discovered tenant write routes return 403 for PLATFORM_SUPPORT", async () => {
    for (const { relPath, fullPath, methods } of discoveredRoutes) {
      const mod = await import(pathToFileURL(fullPath).href);
      for (const method of methods) {
        const handler = mod[method];
        const req = new Request(`http://localhost/api/test?centerId=${center.id}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method !== "DELETE" ? JSON.stringify({ centerId: center.id, action: "INITIATE_BY_ADMIN" }) : undefined,
        });
        const res = await handler(req, { params: { id: "test-id" } });
        expect(
          res.status,
          `Route ${relPath} method ${method} expected 403 for PLATFORM_SUPPORT, got ${res.status}`
        ).toBe(403);
      }
    }
  });

  it("new route handler without manual isWrite flag automatically derives isWrite from HTTP method and returns 403 on write", async () => {
    const { requireTenantAccess } = await import("../src/lib/tenant");

    async function newRoutePostHandler(req: Request) {
      try {
        const tenantCtx = await requireTenantAccess(req);
        return new Response(JSON.stringify({ ok: true, centerId: tenantCtx.center.id }), { status: 200 });
      } catch (err: unknown) {
        const error = err as { message?: string; status?: number };
        return new Response(JSON.stringify({ error: error?.message }), { status: error?.status || 500 });
      }
    }

    async function newRouteGetHandler(req: Request) {
      try {
        const tenantCtx = await requireTenantAccess(req);
        return new Response(JSON.stringify({ ok: true, centerId: tenantCtx.center.id }), { status: 200 });
      } catch (err: unknown) {
        const error = err as { message?: string; status?: number };
        return new Response(JSON.stringify({ error: error?.message }), { status: error?.status || 500 });
      }
    }

    const getReq = new Request("http://localhost/api/new-feature-endpoint", { method: "GET" });
    const getRes = await newRouteGetHandler(getReq);
    expect(getRes.status).toBe(200);

    const postReq = new Request("http://localhost/api/new-feature-endpoint", {
      method: "POST",
      body: JSON.stringify({ data: "new" }),
    });
    const postRes = await newRoutePostHandler(postReq);
    expect(postRes.status).toBe(403);

    const deleteReq = new Request("http://localhost/api/new-feature-endpoint", { method: "DELETE" });
    const deleteRes = await newRoutePostHandler(deleteReq);
    expect(deleteRes.status).toBe(403);
  });

  it("exclusion mapping explicitly documents all 9 categories with non-empty reasons", () => {
    const requiredCategories = [
      "api/auth/*",
      "api/platform/*",
      "api/developer/*",
      "api/tickets/*",
      "api/notifications",
      "api/invites/accept",
      "api/invites/redeem",
      "api/tenant/onboarding",
      "api/health",
    ];

    expect(EXCLUDED_ROUTES_MAP.length).toBe(requiredCategories.length);
    for (const cat of requiredCategories) {
      const found = EXCLUDED_ROUTES_MAP.find((m) => m.route === cat);
      expect(found, `Missing documented exclusion for ${cat}`).toBeDefined();
      expect(found?.reason.length).toBeGreaterThan(10);
    }
  });

  it("PLATFORM_SUPPORT cannot write to /api/tenant/onboarding (returns 403)", async () => {
    const { POST: onboardingPost } = await import("../src/app/api/tenant/onboarding/route");
    const req = new Request("http://localhost/api/tenant/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Illegal Support Center", slug: "illegal-center", centerType: "OFFLINE" }),
    });
    const res = await onboardingPost(req);
    expect(res.status).toBe(403);
  });

  it("PLATFORM_SUPPORT cannot write to /api/invites/accept (returns 403)", async () => {
    const { POST: acceptPost } = await import("../src/app/api/invites/accept/route");
    const req = new Request("http://localhost/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ANY-CODE-123" }),
    });
    const res = await acceptPost(req);
    expect(res.status).toBe(403);
  });
});

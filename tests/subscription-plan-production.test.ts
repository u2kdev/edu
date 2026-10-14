import { describe, it, expect, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashJti } from "../src/lib/auth";
import fs from "fs";
import path from "path";
import { POST as createCenter } from "../src/app/api/platform/centers/route";
import { POST as onboardingRoute } from "../src/app/api/tenant/onboarding/route";
import { assertNoAutomaticPlanCreation } from "../src/lib/subscription-plans";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
    set: vi.fn(),
  }),
}));

const mockRequest = (url: string, method: "POST", body: unknown, ip: string = `10.99.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });

describe("LAUNCH-1 Item 3: Fallback subscription plan production constraints", () => {
  afterAll(async () => {
    vi.unstubAllEnvs();
  });

  it("assertNoAutomaticPlanCreation throws in production environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertNoAutomaticPlanCreation()).toThrow(
      /Automatic fallback subscription plan creation is strictly forbidden in production/i
    );

    vi.stubEnv("NODE_ENV", "test");
    expect(() => assertNoAutomaticPlanCreation()).not.toThrow();
  });

  it("POST /api/tenant/onboarding in production does NOT create a fallback plan when none exists", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const user = await db.platformUser.create({
      data: {
        email: `onboard-plan-${Date.now()}@test.com`,
        fullName: "Plan User",
        passwordHash: "hash123",
        emailVerified: new Date(),
        isActive: true,
      },
    });

    const jti = `onboard-jti-${Date.now()}`;
    await db.userSession.create({
      data: {
        userId: user.id,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ipAddress: "127.0.0.1",
      },
    });

    mockToken = signJWT(
      {
        userId: user.id,
        email: user.email,
        platformRole: "NONE",
      },
      "7d",
      jti
    );

    // Count existing plans before request
    const plansBefore = await db.subscriptionPlan.count();

    // Temporarily deactivate all plans to simulate clean unconfigured production DB
    await db.subscriptionPlan.updateMany({ data: { isActive: false } });

    try {
      const res = await onboardingRoute(
        mockRequest("/api/tenant/onboarding", "POST", {
          name: "Onboard No Plan Center",
          slug: `no-plan-${Date.now()}`,
        })
      );

      // Must fail with 500 configuration error, NOT create a fallback plan
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toMatch(/Тарифные планы еще не настроены/i);

      // Verify no plan was silently inserted into DB
      const plansAfter = await db.subscriptionPlan.count();
      expect(plansAfter).toBe(plansBefore);
    } finally {
      // Restore active status
      await db.subscriptionPlan.updateMany({ data: { isActive: true } });
      await db.userSession.deleteMany({ where: { userId: user.id } });
      await db.platformUser.delete({ where: { id: user.id } });
    }
  });

  it("POST /api/platform/centers rejects invalid planId with 400 and never creates fallback plan", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const admin = await db.platformUser.create({
      data: {
        email: `sa-plan-${Date.now()}@test.com`,
        fullName: "Super Admin Plan",
        passwordHash: "hash123",
        platformRole: "SUPERADMIN",
        emailVerified: new Date(),
        isActive: true,
      },
    });

    const jti = `admin-jti-${Date.now()}`;
    await db.userSession.create({
      data: {
        userId: admin.id,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ipAddress: "127.0.0.1",
      },
    });

    mockToken = signJWT(
      {
        userId: admin.id,
        email: admin.email,
        platformRole: "SUPERADMIN",
      },
      "7d",
      jti
    );

    const plansBefore = await db.subscriptionPlan.count();

    const res = await createCenter(
      mockRequest("/api/platform/centers", "POST", {
        name: "Center With Bad Plan",
        slug: `bad-plan-${Date.now()}`,
        directorEmail: `dir-bad-${Date.now()}@test.com`,
        directorFullName: "Dir Bad",
        planId: "non-existent-plan-id-12345",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/тарифный план не найден/i);

    const plansAfter = await db.subscriptionPlan.count();
    expect(plansAfter).toBe(plansBefore);

    await db.userSession.deleteMany({ where: { userId: admin.id } });
    await db.platformUser.delete({ where: { id: admin.id } });
  });

  it("static code audit: src/ has no automatic subscriptionPlan creation outside admin plans route", () => {
    const srcDir = path.resolve(process.cwd(), "src");

    function getAllFiles(dir: string, fileList: string[] = []): string[] {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
          getAllFiles(filePath, fileList);
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          fileList.push(filePath);
        }
      }
      return fileList;
    }

    const allFiles = getAllFiles(srcDir);
    const offendingFiles: string[] = [];

    const allowedPlanCreateRoutes = [
      path.normalize("src/app/api/platform/plans/route.ts"),
    ];

    for (const filePath of allFiles) {
      const relativePath = path.normalize(path.relative(process.cwd(), filePath));
      if (allowedPlanCreateRoutes.includes(relativePath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      if (
        content.includes("subscriptionPlan.create") ||
        content.includes("subscriptionPlan.upsert")
      ) {
        offendingFiles.push(relativePath);
      }
    }

    expect(offendingFiles).toEqual([]);
  });
});

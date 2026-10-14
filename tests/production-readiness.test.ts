import { describe, it, expect, afterAll, vi } from "vitest";
import { validateProductionStartupEnv, ensureProductionStartup } from "../src/lib/startup-checks";
import nextConfig from "../next.config.mjs";
import { POST as devLoginRoute } from "../src/app/api/auth/dev-login/route";
import fs from "fs";
import path from "path";

describe("LAUNCH-1 Item 4: Production readiness and startup checks", () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  describe("Startup environment validation", () => {
    const validProdEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      JWT_SECRET: "abcdefghijklmnopqrstuvwxyz1234567890", // >= 32 chars
      DATABASE_URL: "postgresql://user:pass@ep-pooler.neon.tech/db?sslmode=require",
      DIRECT_URL: "postgresql://user:pass@ep-direct.neon.tech/db?sslmode=require",
      APP_URL: "https://lms.platform.uz",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_1234567890abcdef",
      EMAIL_FROM: "noreply@platform.uz",
      TRUSTED_PROXY_HOPS: "1",
      CRON_SECRET: "cron_secret_super_secure_123456",
    };

    it("passes validation when all production variables are properly set", () => {
      const res = validateProductionStartupEnv(validProdEnv);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    it("fails validation if JWT_SECRET is missing or shorter than 32 chars", () => {
      const res = validateProductionStartupEnv({ ...validProdEnv, JWT_SECRET: "short" });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("JWT_SECRET"))).toBe(true);
    });

    it("fails validation if DATABASE_URL or DIRECT_URL is missing", () => {
      const resDb = validateProductionStartupEnv({ ...validProdEnv, DATABASE_URL: "" });
      expect(resDb.valid).toBe(false);
      expect(resDb.errors.some((e) => e.includes("DATABASE_URL"))).toBe(true);

      const resDirect = validateProductionStartupEnv({ ...validProdEnv, DIRECT_URL: "" });
      expect(resDirect.valid).toBe(false);
      expect(resDirect.errors.some((e) => e.includes("DIRECT_URL"))).toBe(true);
    });

    it("fails validation if APP_URL is invalid", () => {
      const res = validateProductionStartupEnv({ ...validProdEnv, APP_URL: "not-a-url" });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("APP_URL"))).toBe(true);
    });

    it("fails validation if EMAIL_PROVIDER is not resend or RESEND_API_KEY is missing", () => {
      const resProvider = validateProductionStartupEnv({ ...validProdEnv, EMAIL_PROVIDER: "smtp" });
      expect(resProvider.valid).toBe(false);
      expect(resProvider.errors.some((e) => e.includes("EMAIL_PROVIDER"))).toBe(true);

      const resKey = validateProductionStartupEnv({ ...validProdEnv, RESEND_API_KEY: "" });
      expect(resKey.valid).toBe(false);
      expect(resKey.errors.some((e) => e.includes("RESEND_API_KEY"))).toBe(true);
    });

    it("fails validation if TRUSTED_PROXY_HOPS is missing or invalid", () => {
      const res = validateProductionStartupEnv({ ...validProdEnv, TRUSTED_PROXY_HOPS: "" });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("TRUSTED_PROXY_HOPS"))).toBe(true);
    });

    it("fails validation if CRON_SECRET is missing or shorter than 16 chars", () => {
      const res = validateProductionStartupEnv({ ...validProdEnv, CRON_SECRET: "short" });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("CRON_SECRET"))).toBe(true);
    });

    it("build phase without secrets does not throw (NEXT_PHASE=phase-production-build)", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PHASE", "phase-production-build");
      expect(() => ensureProductionStartup()).not.toThrow();
    });
  });

  describe("Inaccessibility of dev features in production", () => {
    it("POST /api/auth/dev-login returns 404 in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("DEV_LOGIN", "true"); // even if explicitly set to true, production must override

      const req = new Request("http://localhost/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "some-user" }),
      });

      const res = await devLoginRoute(req);
      expect(res.status).toBe(404);
    });

    it("dev ui-kit page has production guard calling notFound()", () => {
      const pagePath = path.resolve(process.cwd(), "src/app/dev/ui-kit/page.tsx");
      expect(fs.existsSync(pagePath)).toBe(true);
      const content = fs.readFileSync(pagePath, "utf-8");
      expect(content).toMatch(/process\.env\.NODE_ENV\s*===\s*["']production["']/);
      expect(content).toMatch(/notFound\(\)/);
    });

    it("prisma/seed.ts contains production abort guard", () => {
      const seedFile = fs.readFileSync(path.resolve(process.cwd(), "prisma/seed.ts"), "utf-8");
      expect(seedFile).toMatch(/process\.env\.NODE_ENV\s*===\s*"production"/);
      expect(seedFile).toMatch(/Cannot run seed script in production/i);
    });
  });

  describe("Security headers in next.config.mjs", () => {
    it("configures HSTS, nosniff, frame-options, referrer-policy, and baseline CSP", async () => {
      expect(typeof nextConfig.headers).toBe("function");
      if (!nextConfig.headers) {
        throw new Error("nextConfig.headers is not defined");
      }
      const headersConfig = await nextConfig.headers();
      expect(Array.isArray(headersConfig)).toBe(true);

      const catchAll = headersConfig.find((entry: { source: string }) => entry.source.includes(":path*"));
      expect(catchAll).toBeDefined();
      if (!catchAll) {
        throw new Error("catchAll route header config is missing");
      }

      const headers = catchAll.headers as Array<{ key: string; value: string }>;
      const headerMap = new Map(headers.map((h) => [h.key.toLowerCase(), h.value]));

      expect(headerMap.get("strict-transport-security")).toMatch(/max-age=/);
      expect(headerMap.get("x-content-type-options")).toBe("nosniff");
      expect(headerMap.get("x-frame-options")).toMatch(/DENY|SAMEORIGIN/);
      expect(headerMap.get("referrer-policy")).toMatch(/strict-origin/);
      expect(headerMap.get("content-security-policy")).toMatch(/default-src 'self'/);
    });
  });

  describe("Cookie security flags audit across all auth cookie setters", () => {
    it("verifies all cookie setters use httpOnly, sameSite lax, and secure in production", () => {
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
      for (const filePath of allFiles) {
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.includes("cookies().set") || content.includes("response.cookies.set")) {
          if (content.includes('"auth_token"') || content.includes("'auth_token'")) {
            expect(content).toMatch(/httpOnly:\s*true/);
            expect(content).toMatch(/sameSite:\s*["']lax["']/);
            expect(content).toMatch(/secure:\s*(process\.env\.NODE_ENV\s*===|String\(process\.env\.NODE_ENV\))/);
          }
        }
      }
    });
  });
});

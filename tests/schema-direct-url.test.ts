import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("Database DIRECT_URL configuration and migrations (FIX-1 Item 6)", () => {
  it("1. schema.prisma defines directUrl = env('DIRECT_URL')", () => {
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toMatch(/directUrl\s*=\s*env\("DIRECT_URL"\)/);
  });

  it("2. .env.example documents DIRECT_URL", () => {
    const envExamplePath = path.join(process.cwd(), ".env.example");
    const content = fs.readFileSync(envExamplePath, "utf-8");
    expect(content).toContain("DIRECT_URL");
  });

  it("3. DEPLOY.md exists and documents DIRECT_URL configuration", () => {
    const deployMdPath = path.join(process.cwd(), "DEPLOY.md");
    expect(fs.existsSync(deployMdPath)).toBe(true);
    const content = fs.readFileSync(deployMdPath, "utf-8");
    expect(content).toContain("DIRECT_URL");
  });

  it("4. Prisma migrations succeed on a clean schema using DIRECT_URL", () => {
    const baseDbUrl =
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      "postgresql://postgres:admin@localhost:5432/lms_test?schema=public";
    const schemaName = `clean_mig_${Date.now()}`;
    const urlObj = new URL(baseDbUrl);
    urlObj.searchParams.set("schema", schemaName);
    const isolatedUrl = urlObj.toString();

    const env = {
      ...process.env,
      DATABASE_URL: isolatedUrl,
      DIRECT_URL: isolatedUrl,
    };

    const out = execSync("npx prisma migrate deploy", {
      env,
      encoding: "utf-8",
      stdio: "pipe",
    });
    expect(out).toContain("migrations found");
  }, 30000);
});

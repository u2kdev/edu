import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Production Seed & Credential Security Audit", () => {
  it("prisma/seed.ts enforces fail-closed production lockout", () => {
    const seedContent = fs.readFileSync(
      path.resolve(__dirname, "../prisma/seed.ts"),
      "utf8"
    );

    expect(seedContent).toContain('process.env.NODE_ENV === "production"');
    expect(seedContent).toContain("CRITICAL SECURITY ERROR");
    expect(seedContent).toContain("process.exit(1)");
  });

  it("first-owner script does not hardcode default passwords", () => {
    const ownerScript = fs.readFileSync(
      path.resolve(__dirname, "../scripts/first-owner.ts"),
      "utf8"
    );

    expect(ownerScript).not.toContain("Password123!");
    expect(ownerScript).not.toContain("MobilePass123!");
  });

  it("mobile release UI components do not expose demo passwords", () => {
    const uiContent = fs.readFileSync(
      path.resolve(__dirname, "../mobile/src/components/ui.tsx"),
      "utf8"
    );

    expect(uiContent).not.toContain("Password123!");
    expect(uiContent).not.toContain("MobilePass123!");
  });
});

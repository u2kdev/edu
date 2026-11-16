import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Platform Owner Dashboard (UI1/UI3 semantic theme)", () => {
  const rootDir = process.cwd();
  const dashboardPath = path.join(rootDir, "src", "app", "platform-admin", "page.tsx");
  const interactivePath = path.join(
    rootDir,
    "src",
    "components",
    "platform",
    "PlatformDashboardInteractive.tsx"
  );
  const legacyPlatformPagePath = path.join(rootDir, "src", "app", "platform", "page.tsx");

  it("platform-admin dashboard and interactive charts use UI1 semantic tokens without raw dark slate", () => {
    expect(fs.existsSync(dashboardPath), "platform-admin/page.tsx must exist").toBe(true);
    expect(fs.existsSync(interactivePath), "PlatformDashboardInteractive.tsx must exist").toBe(true);
    const pageContent = fs.readFileSync(dashboardPath, "utf8");
    const interactiveContent = fs.readFileSync(interactivePath, "utf8");
    const combined = `${pageContent}\n${interactiveContent}`;

    expect(pageContent).toContain('from "@/components/ui/card"');
    expect(interactiveContent).toContain("PageHeader");
    expect(interactiveContent).toContain("StatCard");

    // Must NOT contain raw legacy slate/white classes
    expect(combined).not.toContain("bg-slate-950");
    expect(combined).not.toContain("border-slate-800");
    expect(combined).not.toContain("bg-white");
  });

  it("platform-admin dashboard queries real data, renders interactive analytics and impersonation", () => {
    const pageContent = fs.readFileSync(dashboardPath, "utf8");
    const interactiveContent = fs.readFileSync(interactivePath, "utf8");

    expect(pageContent).toContain("expiringSubscriptions");
    expect(pageContent).toContain("recentCenters");
    expect(pageContent).toContain("ImpersonateButton");
    expect(pageContent).toContain("PlatformDashboardInteractive");
    expect(pageContent).toContain("t(locale");

    expect(interactiveContent).toContain("/api/platform/dashboard");
    expect(interactiveContent).toContain("AreaLineChart");
    expect(interactiveContent).toContain("DonutChart");
    expect(interactiveContent).toContain("BarChart");
  });

  it("platform page redirects to platform-admin to unify routes", () => {
    expect(fs.existsSync(legacyPlatformPagePath), "platform/page.tsx must exist").toBe(true);
    const content = fs.readFileSync(legacyPlatformPagePath, "utf8");
    expect(content).toMatch(/redirect\(["']\/platform-admin["']\)/);
  });
});

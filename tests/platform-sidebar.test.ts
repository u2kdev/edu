import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Platform Sidebar & AppShell Architecture", () => {
  const rootDir = process.cwd();
  const navigationConfigPath = path.join(rootDir, "src", "config", "navigation.ts");
  const appShellPath = path.join(rootDir, "src", "components", "shell", "AppShell.tsx");
  const platformAdminLayoutPath = path.join(rootDir, "src", "app", "platform-admin", "layout.tsx");

  it("navigation config defines platform routes and AppShell provides accessible navigation", () => {
    expect(fs.existsSync(navigationConfigPath)).toBe(true);
    expect(fs.existsSync(appShellPath)).toBe(true);

    const navContent = fs.readFileSync(navigationConfigPath, "utf8");
    expect(navContent).toContain("/platform-admin");
    expect(navContent).toContain("/platform-admin/centers");
    expect(navContent).toContain("/platform-admin/plans");
    expect(navContent).toContain("/platform-admin/subscriptions");
    expect(navContent).toContain("/platform-admin/support");
    expect(navContent).toContain("/platform-admin/audit");

    const shellContent = fs.readFileSync(appShellPath, "utf8");
    expect(shellContent).toContain("common.brandName");
    expect(shellContent).toMatch(/aria-label/i);
    expect(shellContent).toContain("Sheet");
  });

  it("platform-admin layout wraps PanelThemeProvider and unified AppShell", () => {
    expect(fs.existsSync(platformAdminLayoutPath)).toBe(true);
    const content = fs.readFileSync(platformAdminLayoutPath, "utf8");

    expect(content).toContain("PanelThemeProvider");
    expect(content).toContain("AppShell");
    expect(content).toContain('scope="platform"');
  });
});

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { DEV_DEMO_PRESETS, DEV_DEFAULT_PASSWORD, DevQuickLogin, DevRoleSwitcher } from "../mobile/src/components/dev-quick-login.prod";

describe("Mobile Release Security & Production Bundling", () => {
  it("production login.tsx does not contain hardcoded demo passwords or credentials", () => {
    const loginContent = fs.readFileSync(
      path.resolve(__dirname, "../mobile/app/(auth)/login.tsx"),
      "utf8"
    );

    expect(loginContent).not.toContain("MobilePass123!");
    expect(loginContent).not.toContain("Password123!");
    expect(loginContent).not.toContain("c1-student13@example.com");
    expect(loginContent).not.toContain("c1-teacher1@example.com");
  });

  it("shared ui.tsx does not leak DEMO_ROLE_PRESETS into production tree", () => {
    const uiContent = fs.readFileSync(
      path.resolve(__dirname, "../mobile/src/components/ui.tsx"),
      "utf8"
    );

    expect(uiContent).not.toContain("export const DEMO_ROLE_PRESETS");
    expect(uiContent).not.toContain("MobilePass123!");
    expect(uiContent).not.toContain("c1-student13@example.com");
  });

  it("dev-quick-login.prod exports empty stubs and returns null for release builds", () => {
    expect(DEV_DEMO_PRESETS).toEqual([]);
    expect(DEV_DEFAULT_PASSWORD).toBe("");
    expect(DevQuickLogin()).toBeNull();
    expect(DevRoleSwitcher()).toBeNull();
  });

  it("metro.config.js redirects dev-quick-login to dev-quick-login.prod in production mode", () => {
    const metroConfigContent = fs.readFileSync(
      path.resolve(__dirname, "../mobile/metro.config.js"),
      "utf8"
    );

    expect(metroConfigContent).toContain("process.env.NODE_ENV === \"production\"");
    expect(metroConfigContent).toContain("dev-quick-login.prod.tsx");
  });
});

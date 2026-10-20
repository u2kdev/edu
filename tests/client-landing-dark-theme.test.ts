import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Dark theme for the public surface.
 *
 * The switch is CSS-variable based: `data-theme` on <html> is applied before the
 * first paint by an inline bootstrap, and every dark rule is scoped to
 * `.public-shell`, so the dashboards keep their own palette.
 */
describe("Public surface dark theme", () => {
  const root = process.cwd();
  const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf-8");

  const globalsCss = read("src", "app", "globals.css");
  const layout = read("src", "app", "layout.tsx");
  const themeProvider = read("src", "components", "landing", "ThemeProvider.tsx");
  const toggle = read("src", "components", "landing", "ThemeToggle.tsx");
  const header = read("src", "components", "landing", "Header.tsx");

  it("defines the dark token block only for the public shell", () => {
    expect(globalsCss).toContain('html[data-theme="dark"] .public-shell');
    // The shell must be able to opt out (auth pages stay light for now).
    expect(globalsCss).toContain(':not([data-theme="light"])');
    // Core surface/ink tokens are redefined for dark.
    for (const token of ["--ink:", "--paper:", "--line:", "--brand:", "--surface-a95:", "--grad-a:"]) {
      expect(globalsCss).toContain(token);
    }
    // Dark rules must never be global.
    expect(globalsCss).not.toMatch(/^html\[data-theme="dark"\]\s*\{/m);
  });

  it("applies the saved theme before paint via an inline bootstrap", () => {
    expect(layout).toContain("edarschi-theme");
    expect(layout).toContain("data-theme");
    expect(layout).toContain("prefers-color-scheme: dark");
    // The legacy `.dark` class would repaint the dashboards through body tokens.
    expect(themeProvider).not.toContain("classList.toggle");
  });

  it("keeps the light default and persists the visitor choice", () => {
    expect(themeProvider).toMatch(/useState<Theme>\(["']light["']\)/);
    expect(themeProvider).toContain('setAttribute("data-theme"');
    expect(themeProvider).toContain("localStorage.setItem");
  });

  it("supports a ?theme= pin for demos, QA and shared links", () => {
    // Both the pre-paint bootstrap and the provider read the query parameter.
    expect(layout).toContain('get("theme")');
    expect(themeProvider).toContain('get("theme")');
    expect(themeProvider).toContain('pinned === "light" || pinned === "dark"');
  });

  it("exposes an accessible toggle in the header", () => {
    expect(header).toContain("ThemeToggle");
    expect(toggle).toContain("aria-pressed");
    expect(toggle).toContain("aria-label");
    expect(toggle).toContain("t.header.theme.toDark");
    expect(toggle).toContain("t.header.theme.toLight");
  });

  it("ships theme labels in both landing locales with matching keys", () => {
    const ru = JSON.parse(read("messages", "ru.json"));
    const uz = JSON.parse(read("messages", "uz.json"));

    for (const messages of [ru, uz]) {
      expect(typeof messages.header.theme.toDark).toBe("string");
      expect(typeof messages.header.theme.toLight).toBe("string");
      expect(messages.header.theme.toDark.length).toBeGreaterThan(0);
      expect(messages.header.theme.toLight.length).toBeGreaterThan(0);
    }
    expect(Object.keys(ru.header.theme).sort()).toEqual(Object.keys(uz.header.theme).sort());
  });

  it("keeps the landing free of Tailwind dark: variants (theme lives in tokens)", () => {
    const dir = path.join(root, "src", "components", "landing");
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
      expect(fs.readFileSync(path.join(dir, file), "utf-8")).not.toMatch(/dark:/);
    }
  });

  it("pins the auth surface to light so existing screens are unchanged", () => {
    for (const rel of [
      ["src", "app", "login", "page.tsx"],
      ["src", "app", "(auth)", "register", "page.tsx"],
      ["src", "app", "(auth)", "reset-password", "page.tsx"],
      ["src", "app", "(auth)", "confirm-email", "page.tsx"],
      ["src", "app", "invites", "accept", "page.tsx"],
      ["src", "components", "auth", "AuthShell.tsx"],
    ]) {
      const content = read(...rel);
      expect(content).toContain('data-theme="light"');
      expect(content).toContain("public-shell");
    }
  });
});

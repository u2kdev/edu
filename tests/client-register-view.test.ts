import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Register View Modern Light UI", () => {
  const registerPagePath = path.join(process.cwd(), "src/app/(auth)/register/page.tsx");

  it("exists and is readable", () => {
    expect(fs.existsSync(registerPagePath)).toBe(true);
  });

  it("adheres to strict typography, e-darischi brand, and light theme design system", () => {
    const content = fs.readFileSync(registerPagePath, "utf-8");

    // Strict typography & branding
    expect(content).toContain("font-strict");
    expect(content).toContain("e-darischi");

    // Light theme foundation & background particles/mesh
    expect(content).toMatch(/particles-bg|mesh-gradient-light/);
    expect(content).toContain("bg-white");
    expect(content).toMatch(/border-slate-200|border-slate-300/);

    // Password strength indicator or toggle
    expect(content).toMatch(/strength|Eye|EyeOff|showPassword/i);

    // Navigation to login
    expect(content).toContain("/login");
  });
});

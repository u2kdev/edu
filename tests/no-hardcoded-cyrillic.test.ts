import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("LAUNCH-1 Item 6: No hardcoded Cyrillic in teacher cabinet, gradebook, and homework submission", () => {
  const targetFiles = [
    "src/app/center/grades/page.tsx",
    "src/components/GradebookManager.tsx",
    "src/app/center/homework/page.tsx",
    "src/components/HomeworkManager.tsx",
    "src/app/center/page.tsx",
    "src/app/center/layout.tsx",
  ];

  for (const relativePath of targetFiles) {
    it(`file ${relativePath} contains NO hardcoded Cyrillic characters outside localization keys`, () => {
      const fullPath = path.resolve(process.cwd(), relativePath);
      expect(fs.existsSync(fullPath)).toBe(true);

      const content = fs.readFileSync(fullPath, "utf-8");
      // Find any Cyrillic character: \u0400-\u04FF
      const cyrillicMatches = content.match(/[\u0400-\u04FF]/g) || [];

      expect(cyrillicMatches).toEqual([]);
    });
  }

  it("verifies translation keys exist in ru.json and uz-Latn.json", () => {
    const ruPath = path.resolve(process.cwd(), "src/i18n/locales/ru.json");
    const uzPath = path.resolve(process.cwd(), "src/i18n/locales/uz-Latn.json");

    expect(fs.existsSync(ruPath)).toBe(true);
    expect(fs.existsSync(uzPath)).toBe(true);

    const ru = JSON.parse(fs.readFileSync(ruPath, "utf-8"));
    const uz = JSON.parse(fs.readFileSync(uzPath, "utf-8"));

    expect(ru.grades).toBeDefined();
    expect(uz.grades).toBeDefined();
    expect(ru.homework).toBeDefined();
    expect(uz.homework).toBeDefined();
    expect(ru.dashboard).toBeDefined();
    expect(uz.dashboard).toBeDefined();
  });
});

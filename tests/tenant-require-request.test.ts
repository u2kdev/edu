import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function getAllRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllRouteFiles(fullPath));
    } else if (entry.isFile() && (entry.name === "route.ts" || entry.name === "route.js")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("requireTenantAccess mandatory req argument audit", () => {
  it("enforces that all route handlers pass req to requireTenantAccess", () => {
    const appDir = path.resolve(process.cwd(), "src/app");
    const routeFiles = getAllRouteFiles(appDir);
    expect(routeFiles.length).toBeGreaterThan(0);

    const violations: { file: string; line: string }[] = [];

    // Regex to match requireTenantAccess call
    // Valid: requireTenantAccess(req...) or requireTenantAccess(request...)
    // Invalid: requireTenantAccess() or requireTenantAccess(undefined...) or requireTenantAccess({...)
    const callPattern = /requireTenantAccess\s*\(([^)]*)\)/g;

    for (const filePath of routeFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (!content.includes("requireTenantAccess")) continue;

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match: RegExpExecArray | null;
        callPattern.lastIndex = 0;
        while ((match = callPattern.exec(line)) !== null) {
          const args = match[1].trim();
          // The first argument must be req or request
          const firstArg = args.split(",")[0]?.trim();
          if (firstArg !== "req" && firstArg !== "request") {
            violations.push({
              file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
              line: line.trim(),
            });
          }
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} calls to requireTenantAccess in route.ts without req parameter:\n` +
        violations.map((v) => `${v.file}: ${v.line}`).join("\n")
    ).toEqual([]);
  });
});

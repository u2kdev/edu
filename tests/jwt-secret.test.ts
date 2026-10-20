import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { validateJwtSecret } from "../src/lib/auth";

describe("JWT_SECRET Configuration & Validation", () => {
  it("rejects empty or missing secret in production", () => {
    expect(() => validateJwtSecret(undefined, true)).toThrow(/JWT_SECRET.*production/i);
    expect(() => validateJwtSecret("", true)).toThrow(/JWT_SECRET.*production/i);
  });

  it("rejects secret shorter than 32 characters", () => {
    expect(() => validateJwtSecret("short-secret-key", true)).toThrow(/32 characters/i);
    expect(() => validateJwtSecret("short-secret-key", false)).toThrow(/32 characters/i);
  });

  it("accepts valid secret of at least 32 characters", () => {
    const valid = "a".repeat(32);
    expect(validateJwtSecret(valid, true)).toBe(valid);
    expect(validateJwtSecret(valid, false)).toBe(valid);
  });

  it("imports cleanly in production without JWT_SECRET (build phase safety)", () => {
    // `next build` runs with NODE_ENV=production while collecting page data, and
    // Docker/Vercel builds must not require the runtime secret just to compile.
    const output = execSync(
      'npx tsx -e "process.env.NODE_ENV=\'production\'; process.env.JWT_SECRET=\'\'; require(\'./src/lib/auth.ts\'); console.log(\'MODULE_LOAD_OK\')"',
      { encoding: "utf8" }
    );
    expect(output).toContain("MODULE_LOAD_OK");
  }, 60000);

  it("fails closed on first signing call in production without JWT_SECRET", () => {
    expect(() => {
      execSync(
        'npx tsx -e "process.env.NODE_ENV=\'production\'; process.env.JWT_SECRET=\'\'; const { signJWT } = require(\'./src/lib/auth.ts\'); signJWT({ userId: \'u\', email: \'e@example.com\' })"',
        { stdio: "pipe" }
      );
    }).toThrow();
  }, 60000);

  it("loads module successfully in production with valid 32+ chars JWT_SECRET", () => {
    const output = execSync(
      'npx tsx -e "process.env.NODE_ENV=\'production\'; process.env.JWT_SECRET=\'12345678901234567890123456789012\'; require(\'./src/lib/auth.ts\'); console.log(\'LOADED_SUCCESSFULLY\')"',
      { encoding: "utf8" }
    );
    expect(output).toContain("LOADED_SUCCESSFULLY");
  }, 60000);
});

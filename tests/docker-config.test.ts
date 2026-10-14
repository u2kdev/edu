import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Production Docker and Compose Configuration (Block 6.2d)", () => {
  const rootDir = path.resolve(__dirname, "..");
  const dockerfilePath = path.join(rootDir, "Dockerfile");
  const composeProdPath = path.join(rootDir, "docker-compose.prod.yml");
  const dockerignorePath = path.join(rootDir, ".dockerignore");

  it("Dockerfile exists and defines multi-stage build, non-root user, and healthcheck", () => {
    expect(fs.existsSync(dockerfilePath)).toBe(true);
    const dockerfileContent = fs.readFileSync(dockerfilePath, "utf-8");

    // Multi-stage verification
    expect(dockerfileContent).toMatch(/AS deps/i);
    expect(dockerfileContent).toMatch(/AS builder/i);
    expect(dockerfileContent).toMatch(/AS runner/i);

    // Security & non-root user
    expect(dockerfileContent).toMatch(/USER (nextjs|node|appuser)/i);

    // Healthcheck directive
    expect(dockerfileContent).toMatch(/HEALTHCHECK/i);
    expect(dockerfileContent).toMatch(/\/api\/health/);

    // Expose port
    expect(dockerfileContent).toMatch(/EXPOSE 3000/);
  });

  it("docker-compose.prod.yml exists and defines app and postgres services with healthchecks", () => {
    expect(fs.existsSync(composeProdPath)).toBe(true);
    const composeContent = fs.readFileSync(composeProdPath, "utf-8");

    expect(composeContent).toMatch(/postgres:/);
    expect(composeContent).toMatch(/pg_isready/);
    expect(composeContent).toMatch(/app:/);
    expect(composeContent).toMatch(/\/api\/health/);
    expect(composeContent).toMatch(/restart: unless-stopped/);
    expect(composeContent).toMatch(/NODE_ENV=production|NODE_ENV:\s*"?production"?/);
  });

  it(".dockerignore exists and excludes build artifacts and sensitive directories", () => {
    expect(fs.existsSync(dockerignorePath)).toBe(true);
    const ignoreContent = fs.readFileSync(dockerignorePath, "utf-8");

    expect(ignoreContent).toMatch(/node_modules/);
    expect(ignoreContent).toMatch(/\.next/);
    expect(ignoreContent).toMatch(/\.git/);
  });
});

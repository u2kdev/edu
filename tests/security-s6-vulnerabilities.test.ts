import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import nextConfig from "../next.config.mjs";

interface NextHeaderEntry {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

describe("Stage S6: Infrastructure, CSP Hardening, Backups & Security Policy", () => {
  const rootDir = path.resolve(__dirname, "..");

  // S6.1: CSP & Security Headers Hardening
  describe("S6.1: Content Security Policy & Security Headers", () => {
    it("CSP eliminates 'unsafe-eval' in production script-src and includes Turnstile origins", async () => {
      expect(typeof nextConfig.headers).toBe("function");
      const headersConfig = (typeof nextConfig.headers === "function" ? await nextConfig.headers() : []) as NextHeaderEntry[];
      const globalHeaders = headersConfig.find((h) => h.source === "/:path*");
      expect(globalHeaders).toBeDefined();
      if (!globalHeaders) return;

      const cspHeader = globalHeaders.headers.find(
        (h) => h.key.toLowerCase() === "content-security-policy"
      );
      expect(cspHeader).toBeDefined();
      if (!cspHeader) return;
      const cspValue = cspHeader.value;

      // Must NOT contain unsafe-eval
      expect(cspValue).not.toContain("'unsafe-eval'");

      // Must contain frame-ancestors 'none' to prevent clickjacking
      expect(cspValue).toContain("frame-ancestors 'none'");

      // Must contain base-uri and form-action restrictions
      expect(cspValue).toContain("base-uri 'self'");
      expect(cspValue).toContain("form-action 'self'");

      // Must permit Cloudflare Turnstile script and iframe origins
      expect(cspValue).toContain("https://challenges.cloudflare.com");
    });

    it("includes Permissions-Policy disabling high-risk browser capabilities", async () => {
      expect(typeof nextConfig.headers).toBe("function");
      const headersConfig = (typeof nextConfig.headers === "function" ? await nextConfig.headers() : []) as NextHeaderEntry[];
      const globalHeaders = headersConfig.find((h) => h.source === "/:path*");
      expect(globalHeaders).toBeDefined();
      if (!globalHeaders) return;

      const permHeader = globalHeaders.headers.find(
        (h) => h.key.toLowerCase() === "permissions-policy"
      );
      expect(permHeader).toBeDefined();
      if (!permHeader) return;
      const permValue = permHeader.value;

      expect(permValue).toContain("camera=()");
      expect(permValue).toContain("microphone=()");
      expect(permValue).toContain("geolocation=()");
    });

    it("enforces strict HSTS, X-Content-Type-Options and X-Frame-Options", async () => {
      expect(typeof nextConfig.headers).toBe("function");
      const headersConfig = (typeof nextConfig.headers === "function" ? await nextConfig.headers() : []) as NextHeaderEntry[];
      const globalHeaders = headersConfig.find((h) => h.source === "/:path*");
      expect(globalHeaders).toBeDefined();
      if (!globalHeaders) return;

      const hsts = globalHeaders.headers.find((h) => h.key.toLowerCase() === "strict-transport-security");
      expect(hsts).toBeDefined();
      if (!hsts) return;
      expect(hsts.value).toContain("max-age=63072000");
      expect(hsts.value).toContain("includeSubDomains");
      expect(hsts.value).toContain("preload");

      const nosniff = globalHeaders.headers.find((h) => h.key.toLowerCase() === "x-content-type-options");
      expect(nosniff).toBeDefined();
      if (!nosniff) return;
      expect(nosniff.value).toBe("nosniff");

      const frameOptions = globalHeaders.headers.find((h) => h.key.toLowerCase() === "x-frame-options");
      expect(frameOptions).toBeDefined();
      if (!frameOptions) return;
      expect(frameOptions.value).toBe("DENY");
    });
  });

  // S6.2: Docker Compose & Container Hardening
  describe("S6.2: Docker & Compose Production Hardening", () => {
    const composeProdPath = path.join(rootDir, "docker-compose.prod.yml");
    const dockerfilePath = path.join(rootDir, "Dockerfile");
    const dockerignorePath = path.join(rootDir, ".dockerignore");

    it("docker-compose.prod.yml binds port 3000 to localhost (127.0.0.1) only", () => {
      const content = fs.readFileSync(composeProdPath, "utf-8");
      // Must not expose 3000 directly to 0.0.0.0
      expect(content).not.toMatch(/"3000:3000"/);
      expect(content).toMatch(/127\.0\.0\.1:3000:3000/);
    });

    it("docker-compose.prod.yml enforces security_opt no-new-privileges and mounts persistent storage", () => {
      const content = fs.readFileSync(composeProdPath, "utf-8");
      expect(content).toMatch(/no-new-privileges:true/);
      expect(content).toMatch(/TWO_FACTOR_ENC_KEY/);
      expect(content).toMatch(/storage_prod_data:\/app\/storage/);
      expect(content).toMatch(/storage_prod_data:/);
    });

    it(".dockerignore excludes all SQLite db patterns and storage", () => {
      const content = fs.readFileSync(dockerignorePath, "utf-8");
      expect(content).toMatch(/\*\*\/\*\.db/);
      expect(content).toMatch(/storage/);
    });

    it("Dockerfile provisions non-root nextjs user with dedicated storage volume permissions", () => {
      const content = fs.readFileSync(dockerfilePath, "utf-8");
      expect(content).toMatch(/USER (nextjs|node)/);
      expect(content).toMatch(/storage/);
    });
  });

  // S6.3: Automated Encrypted Database Backup Script
  describe("S6.3: Encrypted Database Backup Script", () => {
    const backupScriptPath = path.join(rootDir, "scripts", "backup-db.sh");

    it("backup-db.sh exists and implements AES-256 / GPG encryption and retention rotation", () => {
      expect(fs.existsSync(backupScriptPath)).toBe(true);
      const content = fs.readFileSync(backupScriptPath, "utf-8");

      // Shell safety flags
      expect(content).toMatch(/set -e/);

      // Must implement encryption (openssl aes-256-cbc with pbkdf2 or gpg)
      expect(content).toMatch(/openssl\s+enc\s+-aes-256-cbc\s+-pbkdf2|gpg\s+--encrypt/i);

      // Must implement backup retention / rotation
      expect(content).toMatch(/RETENTION_DAYS/);
      expect(content).toMatch(/find\s+.*-mtime\s+\+.*-delete/);

      // Must verify backup integrity (non-empty file)
      expect(content).toMatch(/\[\s+-s\s+.*\]/);
    });
  });

  // S6.4: Vulnerability Disclosure Policy & Deployment Documentation
  describe("S6.4: Security Policy and Deployment Sync", () => {
    const securityDocPath = path.join(rootDir, "docs", "SECURITY.md");
    const deployDocPath = path.join(rootDir, "docs", "DEPLOY.md");

    it("docs/SECURITY.md exists and specifies reporting channels, SLA, and architecture controls", () => {
      expect(fs.existsSync(securityDocPath)).toBe(true);
      const content = fs.readFileSync(securityDocPath, "utf-8");

      expect(content).toMatch(/Vulnerability Disclosure Policy|Политика раскрытия уязвимостей/i);
      expect(content).toMatch(/security@|security-report/i);
      expect(content).toMatch(/SLA|реакци/i);
      expect(content).toMatch(/AES-256-GCM/);
      expect(content).toMatch(/Rate Limit/i);
    });

    it("docs/DEPLOY.md synchronizes valid cron endpoints and security environment variables", () => {
      const content = fs.readFileSync(deployDocPath, "utf-8");

      // Must reference actual cron endpoints
      expect(content).toContain("/api/cron/email-outbox");
      expect(content).toContain("/api/cron/cleanup");
      expect(content).toContain("/api/cron/subscriptions");

      // Must document new Stage S1-S5 environment variables
      expect(content).toContain("SETUP_TOKEN");
      expect(content).toContain("TWO_FACTOR_ENC_KEY");
      expect(content).toContain("TURNSTILE_SITE_KEY");
      expect(content).toContain("TURNSTILE_SECRET_KEY");
    });
  });
});

export interface StartupEnvCheckResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates required environment variables for production execution.
 * Required variables in production:
 * - JWT_SECRET (>= 32 chars)
 * - DATABASE_URL (non-empty)
 * - DIRECT_URL (non-empty)
 * - APP_URL (valid http/https URL)
 * - EMAIL_PROVIDER === "resend"
 * - RESEND_API_KEY (non-empty)
 * - EMAIL_FROM (valid email)
 * - TRUSTED_PROXY_HOPS (valid integer)
 * - CRON_SECRET (>= 16 chars)
 */
export function validateProductionStartupEnv(
  env: NodeJS.ProcessEnv = process.env
): StartupEnvCheckResult {
  const errors: string[] = [];

  if (env.NODE_ENV !== "production") {
    return { valid: true, errors: [] };
  }

  // 1. JWT_SECRET
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    errors.push("JWT_SECRET must be set and at least 32 characters long");
  }

  // 2. DATABASE_URL
  if (!env.DATABASE_URL || !env.DATABASE_URL.trim()) {
    errors.push("DATABASE_URL is required");
  }

  // 3. DIRECT_URL
  if (!env.DIRECT_URL || !env.DIRECT_URL.trim()) {
    errors.push("DIRECT_URL is required");
  }

  // 4. APP_URL
  if (!env.APP_URL || !/^https?:\/\//i.test(env.APP_URL.trim())) {
    errors.push("APP_URL must be a valid HTTP or HTTPS URL");
  }

  // 5. EMAIL_PROVIDER
  if (env.EMAIL_PROVIDER !== "resend") {
    errors.push("EMAIL_PROVIDER must be 'resend'");
  }

  // 6. RESEND_API_KEY
  if (!env.RESEND_API_KEY || !env.RESEND_API_KEY.trim()) {
    errors.push("RESEND_API_KEY is required when EMAIL_PROVIDER is resend");
  }

  // 7. EMAIL_FROM
  if (!env.EMAIL_FROM || !env.EMAIL_FROM.includes("@")) {
    errors.push("EMAIL_FROM is required and must be a valid email address");
  }

  // 8. TRUSTED_PROXY_HOPS
  if (
    env.TRUSTED_PROXY_HOPS === undefined ||
    env.TRUSTED_PROXY_HOPS.trim() === "" ||
    isNaN(Number(env.TRUSTED_PROXY_HOPS)) ||
    Number(env.TRUSTED_PROXY_HOPS) < 0
  ) {
    errors.push("TRUSTED_PROXY_HOPS must be a non-negative integer (e.g. 1 for Vercel)");
  }

  // 9. CRON_SECRET
  if (!env.CRON_SECRET || env.CRON_SECRET.length < 16) {
    errors.push("CRON_SECRET must be set and at least 16 characters long");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Invoked on server startup.
 * Skips check during Next.js build phase (`NEXT_PHASE === 'phase-production-build'`)
 * so that builds without secrets succeed.
 */
export function ensureProductionStartup(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  if (process.env.NODE_ENV === "production") {
    const { valid, errors } = validateProductionStartupEnv(process.env);
    if (!valid) {
      throw new Error(
        `[STARTUP_CHECK_FAILED] Production startup environment invalid:\n- ${errors.join(
          "\n- "
        )}`
      );
    }
  }
}

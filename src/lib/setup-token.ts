import crypto from "crypto";

/**
 * Validates a setup token string against process.env.SETUP_TOKEN.
 * Enforces:
 * - Fail-closed: returns false if SETUP_TOKEN is missing, empty, or whitespace.
 * - Constant-time comparison using crypto.timingSafeEqual on SHA-256 digests.
 * - Immunity to RangeError length-mismatch crashes.
 * - Enforces minimum 16-character token in production.
 */
export function verifySetupTokenValue(providedToken: string | null | undefined): boolean {
  const expectedToken = process.env.SETUP_TOKEN;

  // Fail-closed: unset or empty SETUP_TOKEN disables setup
  if (!expectedToken || expectedToken.trim() === "") {
    return false;
  }

  // Minimum length check for production environments
  if (process.env.NODE_ENV === "production" && expectedToken.trim().length < 16) {
    return false;
  }

  if (!providedToken || typeof providedToken !== "string" || providedToken.trim() === "") {
    return false;
  }

  // Pre-hash to 32-byte buffers to prevent length leakage and RangeError
  const expectedHash = crypto.createHash("sha256").update(expectedToken.trim()).digest();
  const providedHash = crypto.createHash("sha256").update(providedToken.trim()).digest();

  return crypto.timingSafeEqual(expectedHash, providedHash);
}

/**
 * Extracts setup token from Request headers ('x-setup-token') or URL searchParams ('?token=').
 */
export function verifySetupToken(req?: Request): boolean {
  if (!req) return false;

  // 1. Check header 'x-setup-token'
  const headerToken = req.headers.get("x-setup-token");
  if (headerToken && verifySetupTokenValue(headerToken)) {
    return true;
  }

  // 2. Check query param '?token='
  try {
    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token");
    if (queryToken && verifySetupTokenValue(queryToken)) {
      return true;
    }
  } catch {
    // Malformed request URL
  }

  return false;
}

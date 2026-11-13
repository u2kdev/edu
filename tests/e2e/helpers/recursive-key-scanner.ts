/**
 * Recursive Key Scanner Helper for Opaque-Box E2E Testing
 *
 * Scans arbitrary JSON data trees returned by API endpoints to guarantee
 * zero leakage of sensitive credentials, hashes, or tokens (Requirement R7).
 */

export const FORBIDDEN_SECRET_KEYS: readonly string[] = [
  "passwordHash",
  "twoFactorSecret",
  "emailConfirmToken",
  "emailConfirmExpires",
  "jtiHash",
  "refreshTokenHash",
  "prevRefreshTokenHash",
  "resetToken",
  "password",
] as const;

export interface ForbiddenKeyViolation {
  path: string;
  key: string;
  value: unknown;
}

/**
 * Recursively inspects an object, array, or primitive for any occurrences
 * of sensitive keys that should never leak to API clients.
 */
export function findForbiddenKeys(data: unknown, currentPath = ""): ForbiddenKeyViolation[] {
  const violations: ForbiddenKeyViolation[] = [];

  if (data === null || data === undefined) {
    return violations;
  }

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      const arrayPath = currentPath ? `${currentPath}[${index}]` : `[${index}]`;
      violations.push(...findForbiddenKeys(item, arrayPath));
    });
    return violations;
  }

  if (typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      const fieldPath = currentPath ? `${currentPath}.${key}` : key;

      // Exact case-insensitive or exact key match check against forbidden list
      const isForbidden = FORBIDDEN_SECRET_KEYS.some(
        (forbidden) => forbidden.toLowerCase() === key.toLowerCase()
      );

      if (isForbidden && value !== undefined) {
        violations.push({
          path: fieldPath,
          key,
          value,
        });
      }

      // Recurse into nested structures
      violations.push(...findForbiddenKeys(value, fieldPath));
    }
  }

  return violations;
}

/**
 * Asserts that the provided payload contains zero forbidden sensitive keys.
 * Throws a detailed Error with the path of the first violation if found.
 */
export function assertNoForbiddenKeys(data: unknown, contextDescription?: string): void {
  const violations = findForbiddenKeys(data);
  if (violations.length > 0) {
    const errorDetails = violations
      .map((v) => `  - key '${v.key}' at path '${v.path}'`)
      .join("\n");
    const prefix = contextDescription ? `[${contextDescription}] ` : "";
    throw new Error(
      `${prefix}Security violation: Sensitive key(s) leaked in API response:\n${errorDetails}`
    );
  }
}

/**
 * Normalizes a phone number to standard E.164 format for Uzbekistan (+998XXXXXXXXX).
 * Returns null if the phone is invalid.
 */
export function normalizePhone(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;

  // Strip all non-digit characters except leading plus
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // If local 9 digits without country code (e.g. 901234567)
  if (/^\d{9}$/.test(cleaned)) {
    return `+998${cleaned}`;
  }

  // If 12 digits starting with 998 (e.g. 998901234567)
  if (/^998\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // If standard international format with at least 10 digits
  if (/^\d{10,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Checks if a string is a valid normalized Uzbekistan phone number (+998XXXXXXXXX).
 */
export function isValidUzPhone(phone: string): boolean {
  return /^\+998\d{9}$/.test(phone);
}

/**
 * Checks if a string looks like an email.
 */
export function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

/**
 * Checks if a string looks like a username (lowercase letters, numbers, dot, underscore, dash, 3-32 chars).
 */
export function isValidUsername(val: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(val.trim().toLowerCase());
}

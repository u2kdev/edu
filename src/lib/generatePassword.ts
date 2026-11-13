import crypto from "crypto";

/**
 * Generates a cryptographically strong, human-readable 16-character password.
 * Guarantees uppercase, lowercase, numbers, and a special character,
 * while excluding ambiguous characters like 0, O, 1, l, I.
 */
export function generateSecurePassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!#%*@";
  const allChars = upper + lower + digits + special;

  // Ensure at least one from each required set
  const getRandom = (charset: string) => {
    const idx = crypto.randomInt(0, charset.length);
    return charset[idx];
  };

  const required = [
    getRandom(upper),
    getRandom(lower),
    getRandom(digits),
    getRandom(special),
  ];

  const remainingLength = Math.max(0, length - required.length);
  const remaining: string[] = [];
  for (let i = 0; i < remainingLength; i++) {
    remaining.push(getRandom(allChars));
  }

  // Shuffle combined characters
  const combined = [...required, ...remaining];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = combined[i];
    combined[i] = combined[j];
    combined[j] = temp;
  }

  return combined.join("");
}

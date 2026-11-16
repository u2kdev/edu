import crypto from "crypto";

/**
 * Base32 character set (RFC 4648)
 */
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes a buffer to RFC 4648 Base32 string (without padding)
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes an RFC 4648 Base32 string into a buffer
 */
export function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a random Base32 secret for TOTP (default 20 bytes = 160 bits)
 */
export function generateTotpSecret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  return base32Encode(buf);
}

/**
 * Generates an RFC 6238 TOTP 6-digit code for a given secret and counter/timestamp
 */
export function generateTotpCode(
  secret: string,
  timestampMs: number = Date.now(),
  stepSeconds: number = 30
): string {
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter), 0);

  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binary % 1_000_000).toString().padStart(6, "0");
  return code;
}

/**
 * Verifies a 6-digit TOTP code against a secret within a time window (+-1 window step by default)
 */
export function verifyTotpCode(
  secret: string,
  code: string,
  options?: { window?: number; timestampMs?: number; stepSeconds?: number; lastStep?: number | null }
): boolean {
  return verifyTotpCodeWithStep(secret, code, options).valid;
}

export function verifyTotpCodeWithStep(
  secret: string,
  code: string,
  options?: { window?: number; timestampMs?: number; stepSeconds?: number; lastStep?: number | null }
): { valid: boolean; step?: number } {
  if (!secret || !code) return { valid: false };
  const cleanCode = code.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleanCode)) return { valid: false };

  const window = options?.window ?? 1;
  const stepSeconds = options?.stepSeconds ?? 30;
  const now = options?.timestampMs ?? Date.now();
  const currentStep = Math.floor(now / 1000 / stepSeconds);

  for (let step = -window; step <= window; step++) {
    const candidateStep = currentStep + step;
    if (options?.lastStep !== undefined && options.lastStep !== null && candidateStep <= options.lastStep) {
      // Replay attack prevention: step already used
      continue;
    }

    const t = (candidateStep * stepSeconds) * 1000;
    const generated = generateTotpCode(secret, t, stepSeconds);
    if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(generated))) {
      return { valid: true, step: candidateStep };
    }
  }

  return { valid: false };
}

/**
 * Generates standard otpauth:// URL for authenticator apps (Google Authenticator, Authy, etc.)
 */
export function generateTotpUri(
  account: string,
  secret: string,
  issuer: string = "e-darschi"
): string {
  const encAccount = encodeURIComponent(account);
  const encIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates readable backup codes (10 codes formatted as "XXXX-XXXX")
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}

/**
 * Normalizes and hashes a backup code with SHA-256
 */
export function hashBackupCode(code: string): string {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return crypto.createHash("sha256").update(clean).digest("hex");
}

/**
 * Verifies a candidate backup code against the JSON-stored array of SHA-256 hashes.
 * If matched, returns valid: true and the updated array with the matched hash removed (single-use).
 */
export function verifyBackupCode(
  code: string,
  storedHashesJson: string | null
): { valid: boolean; remainingHashes: string[] } {
  if (!code || !storedHashesJson) {
    return { valid: false, remainingHashes: [] };
  }

  let hashes: string[] = [];
  try {
    hashes = JSON.parse(storedHashesJson);
    if (!Array.isArray(hashes)) return { valid: false, remainingHashes: [] };
  } catch {
    return { valid: false, remainingHashes: [] };
  }

  const candidateHash = hashBackupCode(code);
  const candidateBuf = Buffer.from(candidateHash);

  let matchIndex = -1;
  for (let i = 0; i < hashes.length; i++) {
    const storedBuf = Buffer.from(hashes[i]);
    if (storedBuf.length === candidateBuf.length && crypto.timingSafeEqual(storedBuf, candidateBuf)) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    return { valid: false, remainingHashes: hashes };
  }

  const remainingHashes = hashes.filter((_, idx) => idx !== matchIndex);
  return { valid: true, remainingHashes };
}

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:gcm:";
const DEFAULT_DEV_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 32 bytes hex

function getEncryptionKey(purpose: "payment" | "default" = "default"): Buffer {
  const envKey =
    purpose === "payment"
      ? process.env.NODE_ENV === "production"
        ? process.env.PAYMENT_CONFIG_ENCRYPTION_KEY
        : process.env.PAYMENT_CONFIG_ENCRYPTION_KEY ||
          process.env.APP_ENCRYPTION_KEY ||
          process.env.TWO_FACTOR_ENC_KEY
      : process.env.APP_ENCRYPTION_KEY || process.env.TWO_FACTOR_ENC_KEY;

  if (!envKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        purpose === "payment"
          ? "CRITICAL SECURITY ERROR: PAYMENT_CONFIG_ENCRYPTION_KEY must be set in production"
          : "CRITICAL SECURITY ERROR: TWO_FACTOR_ENC_KEY or APP_ENCRYPTION_KEY must be set in production"
      );
    }
    return Buffer.from(DEFAULT_DEV_KEY, "hex");
  }

  // Key can be 64-char hex string or 32-char utf8 string
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, "hex");
  }
  if (Buffer.byteLength(envKey, "utf8") === 32) {
    return Buffer.from(envKey, "utf8");
  }

  // Derive 32 bytes deterministically using SHA-256
  return crypto.createHash("sha256").update(envKey).digest();
}

/**
 * Encrypts a plaintext string with AES-256-GCM (random 96-bit IV + 128-bit auth tag).
 */
export function encryptSecret(
  plaintext: string,
  options?: { purpose?: "payment" | "default" }
): string {
  if (!plaintext) return plaintext;
  const key = getEncryptionKey(options?.purpose);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Rejects tampered ciphertext via auth tag verification.
 * Note: for legacy compatibility with unencrypted Base32 secrets, strings without PREFIX are returned as-is
 * unless `requireEncrypted` is true (default false for backwards-compat 2FA; merchant config passes true).
 */
export function decryptSecret(
  stored: string,
  options?: { requireEncrypted?: boolean; purpose?: "payment" | "default" }
): string {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) {
    if (options?.requireEncrypted) {
      throw new Error("Encrypted secret format is invalid");
    }
    return stored;
  }

  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }

  const [ivHex, tagHex, dataHex] = parts;
  const key = getEncryptionKey(options?.purpose);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Computes a deterministic SHA-256 hex digest (useful for verification code / token hashing).
 */
export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

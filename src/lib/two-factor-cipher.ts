import { encryptSecret, decryptSecret } from "./crypto-cipher";

/**
 * Encrypts a plaintext TOTP secret with AES-256-GCM.
 * Thin wrapper around shared `crypto-cipher.ts`.
 */
export function encryptTwoFactorSecret(secret: string): string {
  return encryptSecret(secret);
}

/**
 * Decrypts an encrypted TOTP secret (preserving legacy unencrypted Base32 fallback).
 */
export function decryptTwoFactorSecret(stored: string): string {
  return decryptSecret(stored, { requireEncrypted: false });
}

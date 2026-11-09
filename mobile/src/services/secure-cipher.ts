import { AuthStorage } from "./auth-storage";

const CIPHER_KEY_STORAGE = "app_cache_encryption_key";

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface EncryptedPayload {
  __encrypted: true;
  iv: string;
  data: string;
}

export const SecureCipher = {
  /**
   * Retrieves the AES-GCM 256-bit key from SecureStore, or generates and saves a new one.
   */
  async getOrCreateKey(): Promise<CryptoKey> {
    const existingBase64 = await AuthStorage.getItem(CIPHER_KEY_STORAGE);
    const cryptoObj = globalThis.crypto;
    if (!cryptoObj?.subtle) {
      throw new Error("WebCrypto SubtleCrypto is not available in the current environment");
    }

    if (existingBase64) {
      try {
        const rawKey = base64ToUint8Array(existingBase64);
        return await cryptoObj.subtle.importKey(
          "raw",
          rawKey.buffer as ArrayBuffer,
          { name: "AES-GCM" },
          false,
          ["encrypt", "decrypt"]
        );
      } catch {
        // If stored key is invalid, re-generate below
      }
    }

    // Generate new 256-bit key
    const rawKey = new Uint8Array(32);
    cryptoObj.getRandomValues(rawKey);
    const base64Key = bufferToBase64(rawKey);
    await AuthStorage.setItem(CIPHER_KEY_STORAGE, base64Key);

    return cryptoObj.subtle.importKey(
      "raw",
      rawKey.buffer as ArrayBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  },

  /**
   * Encrypts plaintext string with AES-GCM using the key stored in SecureStore.
   */
  async encrypt(plaintext: string): Promise<string> {
    const key = await this.getOrCreateKey();
    const cryptoObj = globalThis.crypto;
    const iv = new Uint8Array(12);
    cryptoObj.getRandomValues(iv);

    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    const cipherBuffer = await cryptoObj.subtle.encrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      plaintextBytes.buffer as ArrayBuffer
    );

    const payload: EncryptedPayload = {
      __encrypted: true,
      iv: bufferToBase64(iv),
      data: bufferToBase64(cipherBuffer),
    };

    return JSON.stringify(payload);
  },

  /**
   * Decrypts ciphertext string with AES-GCM using the key stored in SecureStore.
   */
  async decrypt(raw: string): Promise<string | null> {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("__encrypted" in parsed) ||
        (parsed as { __encrypted: unknown }).__encrypted !== true
      ) {
        return raw; // Not encrypted, return as is
      }

      const encPayload = parsed as EncryptedPayload;
      const key = await this.getOrCreateKey();
      const cryptoObj = globalThis.crypto;

      const iv = base64ToUint8Array(encPayload.iv);
      const cipherBytes = base64ToUint8Array(encPayload.data);

      const decryptedBuffer = await cryptoObj.subtle.decrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        key,
        cipherBytes.buffer as ArrayBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch {
      return null;
    }
  },

  /**
   * Wipes the encryption key from SecureStore.
   */
  async wipeKey(): Promise<void> {
    await AuthStorage.removeItem(CIPHER_KEY_STORAGE);
  },
};

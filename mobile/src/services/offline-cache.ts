import { AuthStorage } from "./auth-storage";
import { SecureCipher } from "./secure-cipher";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const registeredCacheKeys = new Set<string>([
  "student",
  "student_dashboard",
  "teacher",
  "teacher_dashboard",
  "parent",
  "parent_dashboard",
  "director",
  "director_dashboard",
  "platform",
  "platform_dashboard",
  "schedule",
  "grades",
  "homework",
]);

function isSensitiveCacheKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes("grade") ||
    lower.includes("child") ||
    lower.includes("parent") ||
    lower.includes("student")
  );
}

export const OfflineCache = {
  /**
   * Saves data into secure device storage. Sensitive child and grade records
   * are strictly encrypted with AES-GCM (key in SecureStore) prior to persistence.
   */
  async set<T>(key: string, data: T, ttlMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    registeredCacheKeys.add(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttlMs,
    };
    const serialized = JSON.stringify(entry);

    if (isSensitiveCacheKey(key)) {
      const encrypted = await SecureCipher.encrypt(serialized);
      await AuthStorage.setItem(`offline_cache_${key}`, encrypted);
    } else {
      await AuthStorage.setItem(`offline_cache_${key}`, serialized);
    }
  },

  /**
   * Retrieves data from secure offline cache, decrypting sensitive entries and respecting TTL.
   */
  async get<T>(key: string): Promise<T | null> {
    const raw = await AuthStorage.getItem(`offline_cache_${key}`);
    if (!raw) return null;

    try {
      let plaintext = raw;
      if (isSensitiveCacheKey(key) || raw.includes("__encrypted")) {
        const decrypted = await SecureCipher.decrypt(raw);
        if (!decrypted) {
          // Decryption failed (e.g. key wiped or revoked)
          await AuthStorage.removeItem(`offline_cache_${key}`);
          return null;
        }
        plaintext = decrypted;
      }

      const entry = JSON.parse(plaintext) as CacheEntry<T>;
      if (Date.now() - entry.timestamp > entry.ttlMs) {
        await AuthStorage.removeItem(`offline_cache_${key}`);
        return null;
      }
      return entry.data;
    } catch {
      await AuthStorage.removeItem(`offline_cache_${key}`);
      return null;
    }
  },

  /**
   * Invalidate a single cache entry.
   */
  async invalidate(key: string): Promise<void> {
    await AuthStorage.removeItem(`offline_cache_${key}`);
  },

  /**
   * Wipes all cached business data and secure keys on logout, 401, account deletion, or user switch.
   */
  async clear(): Promise<void> {
    for (const k of registeredCacheKeys) {
      await AuthStorage.removeItem(`offline_cache_${k}`);
    }
    await SecureCipher.wipeKey();
  },
};

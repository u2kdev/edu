import { AuthStorage } from "./auth-storage";

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

export const OfflineCache = {
  /**
   * Saves data into secure encrypted device storage.
   */
  async set<T>(key: string, data: T, ttlMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    registeredCacheKeys.add(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttlMs,
    };
    await AuthStorage.setItem(`offline_cache_${key}`, JSON.stringify(entry));
  },

  /**
   * Retrieves data from secure offline cache, respecting TTL.
   */
  async get<T>(key: string): Promise<T | null> {
    const raw = await AuthStorage.getItem(`offline_cache_${key}`);
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw) as CacheEntry<T>;
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
   * Wipes all cached business data on logout or 401 Unauthorized.
   */
  async clear(): Promise<void> {
    for (const k of registeredCacheKeys) {
      await AuthStorage.removeItem(`offline_cache_${k}`);
    }
  },
};

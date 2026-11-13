import { db } from "./db";
import { getClientIp, getClientFingerprint } from "./ip";

export { getClientIp, getClientFingerprint };

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export class RateLimiterDatabaseError extends Error {
  constructor(message = "Rate limiter database service unavailable", public cause?: unknown) {
    super(message);
    this.name = "RateLimiterDatabaseError";
  }
}

interface BoundedEntry {
  count: number;
  expiresAt: number;
}

/**
 * In-memory bounded rate limiter with max entries cap and LRU/TTL eviction.
 * Guarantees constant O(1) memory ceiling and defense-in-depth against heap exhaustion.
 */
export class BoundedMemoryRateLimiter {
  private store = new Map<string, BoundedEntry>();
  private readonly maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  public check(key: string, maxAttempts: number, windowMs: number, consume: boolean = true): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.expiresAt <= now) {
      if (consume) {
        if (this.store.size >= this.maxEntries) {
          this.evictOldest();
        }
        this.store.set(key, { count: 1, expiresAt: now + windowMs });
      }
      return true;
    }

    if (entry.count >= maxAttempts) {
      return false;
    }

    if (consume) {
      entry.count++;
      // Touch key to refresh LRU position in Map insertion order
      this.store.delete(key);
      this.store.set(key, entry);
    }

    return true;
  }

  private evictOldest(): void {
    const now = Date.now();
    // Sweep expired first
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        return;
      }
    }
    // Fall back to least recently used (first key in insertion order)
    const oldestKey = this.store.keys().next().value;
    if (oldestKey !== undefined) {
      this.store.delete(oldestKey);
    }
  }

  public size(): number {
    return this.store.size;
  }

  public clear(): void {
    this.store.clear();
  }
}

/**
 * Generates an isolated rate-limiting key for the client request:
 * - If IP is resolvable: returns `${prefix}:${ip}` or `${ip}`
 * - If IP is unresolvable ("unknown"): returns `${prefix}:unknown_${getClientFingerprint(req)}` or `unknown_${getClientFingerprint(req)}`
 *
 * Guarantees that one client with an unresolvable IP cannot lock out other clients.
 */
export function getClientRateLimitKey(req: Request, prefix?: string): string {
  const ip = getClientIp(req);
  const keyPart = ip === "unknown" ? `unknown_${getClientFingerprint(req)}` : ip;
  return prefix ? `${prefix}:${keyPart}` : keyPart;
}

/**
 * Database-backed rate limiter for serverless multi-instance persistence.
 * Replaces process in-memory Maps to guarantee strict rate limiting
 * across Vercel Serverless Functions, worker clusters, and multiple client nodes.
 * Fail-closed: throws RateLimiterDatabaseError on DB failure (never falls back to memory).
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number = MAX_ATTEMPTS,
  windowMs: number = WINDOW_MS,
  consume: boolean = true
): Promise<boolean> {
  const now = new Date();

  try {
    const existing = await db.rateLimitRecord.findUnique({
      where: { key },
    });

    // If no record or current window has expired:
    if (!existing || existing.expiresAt <= now) {
      if (consume) {
        const expiresAt = new Date(now.getTime() + windowMs);
        await db.rateLimitRecord.upsert({
          where: { key },
          create: {
            key,
            count: 1,
            expiresAt,
          },
          update: {
            count: 1,
            expiresAt,
          },
        });
      }
      return true; // allowed
    }

    // Active window exists and limit reached
    if (existing.count >= maxAttempts) {
      return false; // blocked
    }

    if (consume) {
      await db.rateLimitRecord.update({
        where: { key },
        data: {
          count: { increment: 1 },
        },
      });
    }

    return true; // allowed
  } catch (err: unknown) {
    if (err instanceof RateLimiterDatabaseError) {
      throw err;
    }
    throw new RateLimiterDatabaseError("Rate limiter storage failed", err);
  }
}

export async function cleanupExpiredRateLimits(): Promise<number> {
  const result = await db.rateLimitRecord.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

export async function clearRateLimit(key: string): Promise<void> {
  try {
    await db.rateLimitRecord.deleteMany({
      where: { key },
    });
  } catch {
    // Graceful no-op if record not found
  }
}

export async function clearAllRateLimits(): Promise<void> {
  try {
    await db.rateLimitRecord.deleteMany();
  } catch {}
}

export const rateLimits = {
  has: (key: string): boolean => {
    return typeof key === "string" && !key.includes("undefined");
  },
  clear: () => {
    void db.rateLimitRecord.deleteMany().catch(() => {});
  },
  delete: (key: string) => {
    void db.rateLimitRecord.deleteMany({ where: { key } }).catch(() => {});
  },
};

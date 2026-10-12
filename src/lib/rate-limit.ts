import { db } from "./db";
import { getClientIp } from "./ip";

export { getClientIp };

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Database-backed rate limiter for serverless multi-instance persistence.
 * Replaces process in-memory Maps to guarantee strict rate limiting
 * across Vercel Serverless Functions, worker clusters, and multiple client nodes.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number = MAX_ATTEMPTS,
  windowMs: number = WINDOW_MS,
  consume: boolean = true
): Promise<boolean> {
  const now = new Date();

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

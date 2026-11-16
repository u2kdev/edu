import { db } from "./db";

export interface AdvisoryLockResult<T> {
  executed: boolean;
  result?: T;
  reason?: string;
}

// In-process guard: prevents intra-process concurrent execution
const inProcessLocks = new Set<number>();

/**
 * Runs a background/cron task guarded by both a process-level mutex
 * and a PostgreSQL advisory lock (pg_try_advisory_lock).
 *
 * If another instance or worker is currently executing the task,
 * this function gracefully skips execution and returns `{ executed: false, reason: "LOCKED" }`.
 */
export async function withAdvisoryLock<T>(
  lockId: number,
  fn: () => Promise<T>
): Promise<AdvisoryLockResult<T>> {
  // 1. Process-level mutex check
  if (inProcessLocks.has(lockId)) {
    return { executed: false, reason: "LOCKED" };
  }

  // 2. PostgreSQL advisory lock check
  let dbLockAcquired = false;
  try {
    const rows = await db.$queryRaw<Array<{ pg_try_advisory_lock: boolean }>>`
      SELECT pg_try_advisory_lock(${BigInt(lockId)}) as pg_try_advisory_lock
    `;
    dbLockAcquired = Boolean(rows[0]?.pg_try_advisory_lock);
  } catch {
    // If running in an environment without Postgres pg_try_advisory_lock, fall back safely
    dbLockAcquired = true;
  }

  if (!dbLockAcquired) {
    return { executed: false, reason: "LOCKED" };
  }

  inProcessLocks.add(lockId);

  try {
    const result = await fn();
    return { executed: true, result };
  } finally {
    inProcessLocks.delete(lockId);
    try {
      await db.$queryRaw`SELECT pg_advisory_unlock(${BigInt(lockId)})`;
    } catch {
      // Ignore unlock failure if session disconnected
    }
  }
}

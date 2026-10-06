export const rateLimits = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

export function checkRateLimit(ip: string, maxAttempts: number = MAX_ATTEMPTS, windowMs: number = WINDOW_MS): boolean {
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now - record.lastAttempt > windowMs) {
    rateLimits.set(ip, { count: 1, lastAttempt: now });
    return true; // allowed
  }
  if (record.count >= maxAttempts) {
    return false; // rate limited
  }
  record.count++;
  record.lastAttempt = now;
  return true; // allowed
}

export function clearRateLimit(ip: string) {
  rateLimits.delete(ip);
}

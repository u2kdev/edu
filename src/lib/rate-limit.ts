const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.lastAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true; // allowed
  }
  if (record.count >= MAX_ATTEMPTS) {
    return false; // rate limited
  }
  record.count++;
  record.lastAttempt = now;
  return true; // allowed
}

export function clearRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

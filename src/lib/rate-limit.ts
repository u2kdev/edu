export const rateLimits = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

import { getClientIp } from "./ip";
export { getClientIp };

export function checkRateLimit(ip: string, maxAttempts: number = MAX_ATTEMPTS, windowMs: number = WINDOW_MS, consume: boolean = true): boolean {
  const now = Date.now();
  const record = rateLimits.get(ip);
  
  if (!record || now - record.lastAttempt > windowMs) {
    if (consume) {
      rateLimits.set(ip, { count: 1, lastAttempt: now });
    }
    return true; // allowed
  }
  
  if (record.count >= maxAttempts) {
    return false; // rate limited
  }
  
  if (consume) {
    record.count++;
    record.lastAttempt = now;
  }
  return true; // allowed
}

export function clearRateLimit(ip: string) {
  rateLimits.delete(ip);
}

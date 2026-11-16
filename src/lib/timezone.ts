import type { NotificationType } from "@prisma/client";
import { addCalendarDays, fromTashkentParts, toTashkentParts } from "./billing";

export const DEFAULT_QUIET_HOURS_START = 21;
export const DEFAULT_QUIET_HOURS_END = 8;

const CRITICAL_NOTIFICATION_TYPES = new Set<string>([
  "INVITE",
  "PAYMENT_CONFIRMED",
  "PASSWORD_RESET",
  "EMAIL_CONFIRMATION",
  "ACCOUNT_LOCKED",
  "LOGIN_CREDENTIALS",
]);

const CRITICAL_EVENT_KEYS = new Set<string>([
  "EMAIL_CONFIRMATION",
  "PASSWORD_RESET",
  "ACCOUNT_LOCKED",
  "INVITE_LINK",
  "LOGIN_CREDENTIALS",
  "PAYMENT_CONFIRMED",
  "SECURITY_ALERT",
]);

export function normalizeQuietHour(hour: number | null | undefined, fallback: number): number {
  if (typeof hour !== "number" || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return fallback;
  }
  return hour;
}

export function isCriticalNotification(params: {
  type?: NotificationType | string | null;
  eventKey?: string | null;
  critical?: boolean;
}): boolean {
  if (params.critical) return true;
  if (params.type && CRITICAL_NOTIFICATION_TYPES.has(String(params.type))) return true;
  if (params.eventKey) {
    const upper = params.eventKey.toUpperCase();
    for (const prefix of CRITICAL_EVENT_KEYS) {
      if (upper === prefix || upper.startsWith(`${prefix}:`)) return true;
    }
  }
  return false;
}

/**
 * Checks whether `now` falls inside quiet hours [quietHoursStart, quietHoursEnd)
 * evaluated in Asia/Tashkent (UTC+5).
 * Default window: 21:00 -> 08:00 Tashkent time.
 * If start === end, quiet hours are disabled.
 */
export function isQuietHoursTashkent(
  now: Date = new Date(),
  quietHoursStart: number = DEFAULT_QUIET_HOURS_START,
  quietHoursEnd: number = DEFAULT_QUIET_HOURS_END
): boolean {
  const start = normalizeQuietHour(quietHoursStart, DEFAULT_QUIET_HOURS_START);
  const end = normalizeQuietHour(quietHoursEnd, DEFAULT_QUIET_HOURS_END);
  if (start === end) return false;

  const { hour } = toTashkentParts(now);
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

/**
 * Returns the UTC Date corresponding to the next end of quiet hours in Asia/Tashkent.
 * If `now` is not in quiet hours, returns `now`.
 */
export function getNextQuietHoursEndTashkent(
  now: Date = new Date(),
  quietHoursStart: number = DEFAULT_QUIET_HOURS_START,
  quietHoursEnd: number = DEFAULT_QUIET_HOURS_END
): Date {
  const start = normalizeQuietHour(quietHoursStart, DEFAULT_QUIET_HOURS_START);
  const end = normalizeQuietHour(quietHoursEnd, DEFAULT_QUIET_HOURS_END);
  if (!isQuietHoursTashkent(now, start, end)) {
    return now;
  }

  const parts = toTashkentParts(now);
  if (start > end && parts.hour >= start) {
    const tomorrow = addCalendarDays(now, 1);
    const tParts = toTashkentParts(tomorrow);
    return fromTashkentParts(tParts.year, tParts.month, tParts.day, end, 0, 0, 0);
  }

  return fromTashkentParts(parts.year, parts.month, parts.day, end, 0, 0, 0);
}

export interface FinanceReportCacheEntry {
  data: Record<string, unknown>;
  expiresAt: number;
}

const financeReportCache = new Map<string, FinanceReportCacheEntry>();
export const FINANCE_REPORT_CACHE_TTL_MS = 120 * 1000;

export function getCachedFinanceReport(cacheKey: string): Record<string, unknown> | null {
  const entry = financeReportCache.get(cacheKey);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  return null;
}

export function setCachedFinanceReport(cacheKey: string, data: Record<string, unknown>): void {
  financeReportCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + FINANCE_REPORT_CACHE_TTL_MS,
  });
}

/**
 * Invalidates all cached financial report entries belonging to a specific center.
 */
export function invalidateFinanceReportCache(centerId: string): void {
  const prefix = `${centerId}:`;
  for (const key of Array.from(financeReportCache.keys())) {
    if (key.startsWith(prefix)) {
      financeReportCache.delete(key);
    }
  }
}

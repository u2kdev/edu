"use client";

import * as React from "react";
import { formatIntegerSpaces, formatUzs } from "@/lib/money";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

export function getChartColor(index: number): string {
  return CHART_COLORS[Math.abs(index) % CHART_COLORS.length];
}

export type ChartValueType = "uzs" | "number" | "percent";

export function formatChartValue(
  value: number,
  valueType: ChartValueType = "number",
  locale: string = "ru",
  compact: boolean = false
): string {
  if (!Number.isFinite(value)) return "0";
  if (valueType === "uzs") {
    return formatUzs(value, { locale, compact, showCurrency: !compact });
  }
  if (valueType === "percent") {
    return `${Math.round(value * 10) / 10}%`;
  }
  return formatIntegerSpaces(value);
}

export interface ChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipPayloadItem[];
  valueType?: ChartValueType;
  locale?: string;
  labelMap?: Record<string, string>;
}

export function ChartTooltip({
  active,
  label,
  payload,
  valueType = "number",
  locale = "ru",
  labelMap,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
      {label !== undefined && label !== "" && (
        <div className="mb-1.5 font-medium text-foreground">{label}</div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const rawKey = String(entry.dataKey ?? entry.name ?? idx);
          const displayName = labelMap?.[rawKey] ?? entry.name ?? rawKey;
          const numeric = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
          return (
            <div key={`${rawKey}-${idx}`} className="flex items-center justify-between gap-4 tabular-nums">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || getChartColor(idx) }}
                  aria-hidden="true"
                />
                <span>{displayName}</span>
              </span>
              <span className="font-semibold text-foreground">
                {formatChartValue(numeric, valueType, locale, false)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

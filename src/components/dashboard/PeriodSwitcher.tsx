"use client";

import * as React from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import type { AnalyticsPeriodPreset } from "@/lib/finance-analytics";

export interface PeriodOption<T extends string = AnalyticsPeriodPreset> {
  key: T;
  label?: string;
}

export interface PeriodSwitcherProps<T extends string = AnalyticsPeriodPreset> {
  value: T;
  onChange: (value: T) => void;
  locale?: string;
  options?: Array<PeriodOption<T>>;
  disabled?: boolean;
  className?: string;
}

export function PeriodSwitcher<T extends string = AnalyticsPeriodPreset>({
  value,
  onChange,
  locale = "ru",
  options,
  disabled = false,
  className,
}: PeriodSwitcherProps<T>) {
  const defaultOptions: Array<PeriodOption<AnalyticsPeriodPreset>> = [
    { key: "7d", label: t(locale, "ui3.period7d") },
    { key: "30d", label: t(locale, "ui3.period30d") },
    { key: "90d", label: t(locale, "ui3.period90d") },
    { key: "12m", label: t(locale, "ui3.period12m") },
  ];

  const items = (options ?? defaultOptions) as Array<PeriodOption<T>>;

  return (
    <div
      role="group"
      aria-label={t(locale, "ui3.periodLabel")}
      className={cn(
        "inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5",
        className
      )}
    >
      {items.map((opt) => {
        const active = value === opt.key;
        const label =
          opt.label ??
          (opt.key === "7d"
            ? t(locale, "ui3.period7d")
            : opt.key === "30d"
            ? t(locale, "ui3.period30d")
            : opt.key === "90d"
            ? t(locale, "ui3.period90d")
            : t(locale, "ui3.period12m"));
        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors tabular-nums",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              active
                ? "bg-card text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_STROKE = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  info: "var(--info)",
} as const;

const TONE_BG = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
} as const;

export type ProgressTone = keyof typeof TONE_STROKE;

export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  tone?: ProgressTone;
  label?: string;
  caption?: string;
  className?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 88,
  strokeWidth = 8,
  tone = "primary",
  label,
  caption,
  className,
}: ProgressRingProps) {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${pct}%`}
      className={cn("inline-flex items-center gap-3", className)}
    >
      <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute text-sm font-semibold text-foreground tabular-nums">
          {pct}%
        </span>
      </div>
      {(label || caption) && (
        <div className="min-w-0 space-y-0.5">
          {label && <div className="text-sm font-medium text-foreground">{label}</div>}
          {caption && <div className="text-xs text-muted-foreground tabular-nums">{caption}</div>}
        </div>
      )}
    </div>
  );
}

export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  label?: string;
  valueLabel?: string;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  tone = "primary",
  label,
  valueLabel,
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)));

  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || valueLabel) && (
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span className="font-medium text-foreground truncate">{label}</span>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {valueLabel ?? `${pct}%`}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `${pct}%`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-all", TONE_BG[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

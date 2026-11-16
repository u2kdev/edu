import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  delta?: {
    value: string;
    tone?: "positive" | "negative" | "neutral";
  };
  hint?: string;
}

const DELTA_STYLES = {
  positive: "text-success",
  negative: "text-destructive",
  neutral: "text-muted-foreground",
} as const;

export function StatCard({
  label,
  value,
  delta,
  hint,
  className,
  ...props
}: StatCardProps) {
  const tone = delta?.tone ?? "neutral";
  const DeltaIcon =
    tone === "positive" ? ArrowUpRight : tone === "negative" ? ArrowDownRight : Minus;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 text-card-foreground",
        className
      )}
      {...props}
    >
      <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <div className="font-display text-xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums whitespace-nowrap",
              DELTA_STYLES[tone]
            )}
          >
            <DeltaIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{delta.value}</span>
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground tabular-nums">{hint}</div>}
    </div>
  );
}

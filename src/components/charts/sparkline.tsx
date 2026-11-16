"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SparklineInner = dynamic(() => import("./sparkline-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-9 w-full" />,
});

export interface SparklineProps {
  values: number[];
  height?: number;
  tone?: "primary" | "success" | "warning" | "destructive";
  label?: string;
  className?: string;
}

const TONE_COLOR = {
  primary: "var(--chart-1)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
} as const;

export function Sparkline({
  values,
  height = 36,
  tone = "primary",
  label,
  className,
}: SparklineProps) {
  const data = React.useMemo(() => values.map((value) => ({ value })), [values]);

  return (
    <div
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label={label ?? `Trend (${values.length} points)`}
    >
      {data.length > 0 && (
        <SparklineInner data={data} height={height} color={TONE_COLOR[tone]} />
      )}
    </div>
  );
}

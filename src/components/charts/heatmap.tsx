"use client";

import * as React from "react";
import { t } from "@/i18n";
import { formatIntegerSpaces } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ChartContainer } from "./chart-container";

export interface HeatmapCell {
  date: string;
  label?: string;
  count: number;
}

export interface AttendanceHeatmapProps {
  title: string;
  subtitle?: string;
  data: HeatmapCell[];
  locale?: string;
  loading?: boolean;
  className?: string;
}

function getLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || maxCount <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted border-border",
  1: "bg-primary/20 border-primary/25",
  2: "bg-primary/45 border-primary/40",
  3: "bg-primary/70 border-primary/60",
  4: "bg-primary border-primary",
};

export function AttendanceHeatmap({
  title,
  subtitle,
  data,
  locale = "ru",
  loading = false,
  className,
}: AttendanceHeatmapProps) {
  const maxCount = React.useMemo(
    () => data.reduce((acc, item) => Math.max(acc, item.count), 0),
    [data]
  );

  // Split flat chronological days into 7-day columns (weeks) cleanly
  const weeks = React.useMemo(() => {
    const out: HeatmapCell[][] = [];
    for (let i = 0; i < data.length; i += 7) {
      out.push(data.slice(i, i + 7));
    }
    return out;
  }, [data]);

  const tableColumns = [
    { key: "date", label: t(locale, "common.date"), align: "left" as const },
    { key: "count", label: t(locale, "charts.value"), align: "right" as const },
  ];

  const tableRows = data.map((cell) => ({
    date: cell.label ?? cell.date,
    count: formatIntegerSpaces(cell.count),
  }));

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      locale={locale}
      loading={loading}
      empty={data.length === 0}
      tableColumns={tableColumns}
      tableRows={tableRows}
      minHeight={180}
      className={className}
    >
      <div className="space-y-3">
        <div className="overflow-x-auto pb-1">
          <div
            role="grid"
            aria-label={title}
            className="inline-flex gap-1.5"
          >
            {weeks.map((week, wIdx) => (
              <div key={wIdx} role="row" className="flex flex-col gap-1.5">
                {week.map((cell) => {
                  const level = getLevel(cell.count, maxCount);
                  const cellTitle = `${cell.label ?? cell.date}: ${formatIntegerSpaces(cell.count)}`;
                  return (
                    <div
                      key={cell.date}
                      role="gridcell"
                      title={cellTitle}
                      aria-label={cellTitle}
                      className={cn(
                        "h-4 w-4 rounded-[3px] border transition-colors",
                        LEVEL_CLASSES[level]
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <span>{t(locale, "charts.attendanceLow")}</span>
          {([0, 1, 2, 3, 4] as const).map((lvl) => (
            <span
              key={lvl}
              className={cn("h-3 w-3 rounded-[2px] border", LEVEL_CLASSES[lvl])}
              aria-hidden="true"
            />
          ))}
          <span>{t(locale, "charts.attendanceHigh")}</span>
        </div>
      </div>
    </ChartContainer>
  );
}

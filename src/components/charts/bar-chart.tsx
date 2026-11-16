"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { t } from "@/i18n";
import { ChartContainer, ChartSkeleton } from "./chart-container";
import { type ChartValueType, formatChartValue, getChartColor } from "./chart-theme";
import type { BarSeriesConfig } from "./bar-chart-inner";

const BarChartInner = dynamic(() => import("./bar-chart-inner"), {
  ssr: false,
  loading: () => <ChartSkeleton height={240} />,
});

export type { BarSeriesConfig };

export interface BarChartProps {
  title: string;
  subtitle?: string;
  data: Record<string, string | number>[];
  xKey: string;
  series: BarSeriesConfig[];
  valueType?: ChartValueType;
  locale?: string;
  loading?: boolean;
  height?: number;
  layout?: "vertical" | "horizontal";
  stacked?: boolean;
  headerActions?: React.ReactNode;
  className?: string;
}

export function BarChart({
  title,
  subtitle,
  data,
  xKey,
  series,
  valueType = "number",
  locale = "ru",
  loading = false,
  height = 240,
  layout = "vertical",
  stacked = false,
  headerActions,
  className,
}: BarChartProps) {
  const legendItems = React.useMemo(
    () =>
      series.map((s, idx) => {
        const sum = data.reduce((acc, row) => acc + Number(row[s.key] ?? 0), 0);
        return {
          key: s.key,
          label: s.label,
          color: s.color ?? getChartColor(idx),
          formattedValue: formatChartValue(sum, valueType, locale, false),
        };
      }),
    [data, locale, series, valueType]
  );

  const tableColumns = [
    { key: xKey, label: t(locale, "charts.period"), align: "left" as const },
    ...series.map((s) => ({
      key: s.key,
      label: s.label,
      align: "right" as const,
    })),
  ];

  const tableRows = data.map((row) => {
    const out: Record<string, string | number> = {
      [xKey]: String(row[xKey] ?? ""),
    };
    for (const s of series) {
      out[s.key] = formatChartValue(Number(row[s.key] ?? 0), valueType, locale, false);
    }
    return out;
  });

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      locale={locale}
      loading={loading}
      empty={data.length === 0 || series.length === 0}
      headerActions={headerActions}
      tableColumns={tableColumns}
      tableRows={tableRows}
      legendItems={legendItems}
      minHeight={height}
      className={className}
    >
      <BarChartInner
        data={data}
        xKey={xKey}
        series={series}
        height={height}
        valueType={valueType}
        locale={locale}
        layout={layout}
        stacked={stacked}
      />
    </ChartContainer>
  );
}

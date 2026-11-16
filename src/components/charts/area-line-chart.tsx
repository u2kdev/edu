"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { t } from "@/i18n";
import { ChartContainer, ChartSkeleton } from "./chart-container";
import { type ChartValueType, formatChartValue, getChartColor } from "./chart-theme";
import type { AreaLineSeriesConfig } from "./area-line-chart-inner";

const AreaLineChartInner = dynamic(() => import("./area-line-chart-inner"), {
  ssr: false,
  loading: () => <ChartSkeleton height={240} />,
});

export type { AreaLineSeriesConfig };

export interface AreaLineChartProps {
  title: string;
  subtitle?: string;
  data: Record<string, string | number>[];
  xKey: string;
  series: AreaLineSeriesConfig[];
  valueType?: ChartValueType;
  locale?: string;
  loading?: boolean;
  height?: number;
  variant?: "area" | "line";
  headerActions?: React.ReactNode;
  className?: string;
}

export function AreaLineChart({
  title,
  subtitle,
  data,
  xKey,
  series,
  valueType = "number",
  locale = "ru",
  loading = false,
  height = 240,
  variant = "area",
  headerActions,
  className,
}: AreaLineChartProps) {
  const legendItems = React.useMemo(
    () =>
      series.map((s, idx) => {
        const last = data.length > 0 ? Number(data[data.length - 1][s.key] ?? 0) : 0;
        return {
          key: s.key,
          label: s.label,
          color: s.color ?? getChartColor(idx),
          formattedValue: formatChartValue(last, valueType, locale, false),
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
      <AreaLineChartInner
        data={data}
        xKey={xKey}
        series={series}
        height={height}
        valueType={valueType}
        locale={locale}
        variant={variant}
      />
    </ChartContainer>
  );
}

"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { t } from "@/i18n";
import { ChartContainer, ChartSkeleton } from "./chart-container";
import { type ChartValueType, formatChartValue, getChartColor } from "./chart-theme";
import type { DonutDatum } from "./donut-chart-inner";

const DonutChartInner = dynamic(() => import("./donut-chart-inner"), {
  ssr: false,
  loading: () => <ChartSkeleton height={220} />,
});

export type { DonutDatum };

export interface DonutChartProps {
  title: string;
  subtitle?: string;
  data: DonutDatum[];
  valueType?: ChartValueType;
  locale?: string;
  loading?: boolean;
  height?: number;
  centerLabel?: string;
  headerActions?: React.ReactNode;
  className?: string;
}

export function DonutChart({
  title,
  subtitle,
  data,
  valueType = "number",
  locale = "ru",
  loading = false,
  height = 220,
  centerLabel,
  headerActions,
  className,
}: DonutChartProps) {
  const total = React.useMemo(
    () => data.reduce((sum, item) => sum + Math.max(0, item.value), 0),
    [data]
  );

  const nonZero = React.useMemo(() => data.filter((item) => item.value > 0), [data]);

  const legendItems = React.useMemo(
    () =>
      data.map((item, idx) => ({
        key: `${item.name}-${idx}`,
        label: item.name,
        color: item.color ?? getChartColor(idx),
        formattedValue: formatChartValue(item.value, valueType, locale, false),
        percent: total > 0 ? (item.value / total) * 100 : 0,
      })),
    [data, locale, total, valueType]
  );

  const tableColumns = [
    { key: "name", label: t(locale, "charts.category"), align: "left" as const },
    { key: "value", label: t(locale, "charts.value"), align: "right" as const },
    { key: "share", label: t(locale, "charts.share"), align: "right" as const },
  ];

  const tableRows = legendItems.map((item) => ({
    name: item.label,
    value: item.formattedValue,
    share: `${Math.round(item.percent)}%`,
  }));

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      locale={locale}
      loading={loading}
      empty={nonZero.length === 0}
      headerActions={headerActions}
      tableColumns={tableColumns}
      tableRows={tableRows}
      legendItems={legendItems}
      minHeight={height}
      className={className}
    >
      <DonutChartInner
        data={nonZero}
        height={height}
        valueType={valueType}
        locale={locale}
        centerValue={formatChartValue(total, valueType, locale, valueType === "uzs")}
        centerLabel={centerLabel ?? t(locale, "charts.total")}
      />
    </ChartContainer>
  );
}

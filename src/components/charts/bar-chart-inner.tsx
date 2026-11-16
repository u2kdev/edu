"use client";

import * as React from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip, type ChartValueType, formatChartValue, getChartColor } from "./chart-theme";

export interface BarSeriesConfig {
  key: string;
  label: string;
  color?: string;
}

export interface BarChartInnerProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: BarSeriesConfig[];
  height: number;
  valueType: ChartValueType;
  locale: string;
  layout: "vertical" | "horizontal";
  stacked: boolean;
}

export default function BarChartInner({
  data,
  xKey,
  series,
  height,
  valueType,
  locale,
  layout,
  stacked,
}: BarChartInnerProps) {
  const labelMap = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, s.label])),
    [series]
  );

  const isHorizontalBars = layout === "horizontal";

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={isHorizontalBars ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={!isHorizontalBars ? false : true}
            horizontal={!isHorizontalBars ? true : false}
          />
          {isHorizontalBars ? (
            <>
              <XAxis
                type="number"
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatChartValue(Number(v), valueType, locale, true)}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                width={110}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={64}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatChartValue(Number(v), valueType, locale, true)}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={<ChartTooltip valueType={valueType} locale={locale} labelMap={labelMap} />}
          />
          {series.map((s, idx) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? "stack" : undefined}
              fill={s.color ?? getChartColor(idx)}
              radius={stacked ? [0, 0, 0, 0] : isHorizontalBars ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

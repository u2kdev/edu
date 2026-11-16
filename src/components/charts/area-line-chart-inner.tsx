"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip, type ChartValueType, formatChartValue, getChartColor } from "./chart-theme";

export interface AreaLineSeriesConfig {
  key: string;
  label: string;
  color?: string;
}

export interface AreaLineChartInnerProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: AreaLineSeriesConfig[];
  height: number;
  valueType: ChartValueType;
  locale: string;
  variant: "area" | "line";
}

export default function AreaLineChartInner({
  data,
  xKey,
  series,
  height,
  valueType,
  locale,
  variant,
}: AreaLineChartInnerProps) {
  const labelMap = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, s.label])),
    [series]
  );

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
          <Tooltip
            content={<ChartTooltip valueType={valueType} locale={locale} labelMap={labelMap} />}
          />
          {series.map((s, idx) => {
            const color = s.color ?? getChartColor(idx);
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={variant === "area" ? 0.12 : 0}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: color }}
                isAnimationActive={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

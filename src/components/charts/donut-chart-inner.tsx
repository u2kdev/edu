"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltip, type ChartValueType, getChartColor } from "./chart-theme";

export interface DonutDatum {
  name: string;
  value: number;
  color?: string;
}

export interface DonutChartInnerProps {
  data: DonutDatum[];
  height: number;
  valueType: ChartValueType;
  locale: string;
  centerValue?: string;
  centerLabel?: string;
}

export default function DonutChartInner({
  data,
  height,
  valueType,
  locale,
  centerValue,
  centerLabel,
}: DonutChartInnerProps) {
  return (
    <div className="relative w-full" style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart accessibilityLayer={false}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="86%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
            rootTabIndex={-1}
          >
            {data.map((entry, idx) => (
              <Cell key={`${entry.name}-${idx}`} fill={entry.color ?? getChartColor(idx)} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip valueType={valueType} locale={locale} />} />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue || centerLabel) && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6"
        >
          {centerValue && (
            <span className="font-display text-lg font-semibold text-foreground tabular-nums">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

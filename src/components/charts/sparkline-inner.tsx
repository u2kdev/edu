"use client";

import * as React from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

export interface SparklineInnerProps {
  data: { value: number }[];
  height: number;
  color: string;
}

export default function SparklineInner({ data, height, color }: SparklineInnerProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

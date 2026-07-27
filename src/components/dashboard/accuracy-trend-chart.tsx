"use client";

import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TrendPoint = {
  date: string;
  writingAccuracy: number | null;
  speakingScore: number | null;
};

export function AccuracyTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" stroke="currentColor" fontSize={12} />
          <YAxis stroke="currentColor" fontSize={12} width={40} domain={[0, 100]} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="writingAccuracy"
            name="写作正确率"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            dot={{ fill: "hsl(var(--primary))", r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="speakingScore"
            name="口语分数（折算）"
            stroke="hsl(153 46% 42%)"
            strokeWidth={3}
            dot={{ fill: "hsl(153 46% 42%)", r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

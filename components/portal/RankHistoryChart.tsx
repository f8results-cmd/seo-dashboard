'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#1B2B6B', '#E8622A', '#10B981'];

type ChartEntry = { date: string; position: number | null };
type KeywordData = { keyword: string; history: ChartEntry[] };

export default function RankHistoryChart({ data }: { data: KeywordData[] }) {
  // Merge all dates
  const allDates = Array.from(new Set(data.flatMap((k) => k.history.map((h) => h.date))));

  const merged = allDates.map((date) => {
    const entry: Record<string, string | number | null> = { date };
    data.forEach(({ keyword, history }) => {
      const point = history.find((h) => h.date === date);
      entry[keyword] = point?.position ?? null;
    });
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={merged} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#D1D5DB" />
        <YAxis reversed domain={[1, 'auto']} tick={{ fontSize: 11 }} stroke="#D1D5DB" />
        <Tooltip
          formatter={(value) => [`Position ${value}`, '']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        {data.map(({ keyword }, i) => (
          <Line
            key={keyword}
            type="monotone"
            dataKey={keyword}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

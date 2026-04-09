'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import type { Score } from '@/lib/types';

export default function ScoreChart({ scores }: { scores: Score[] }) {
  const data = scores
    .slice()
    .reverse()
    .map((s) => ({
      date: format(new Date(s.recorded_at), 'dd MMM'),
      Local: s.local_seo_score,
      Onsite: s.onsite_seo_score,
      Geo: s.geo_score,
    }));

  if (data.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-400">No score data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#D1D5DB" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#D1D5DB" />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="Local" stroke="#1B2B6B" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Onsite" stroke="#E8622A" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Geo" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { Client } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreItem {
  id: string;
  label: string;
  pts: number;
  max_pts: number;
  pass: boolean;
  detail: string;
}

interface CategoryBreakdown {
  pts: number;
  max_pts: number;
  items: ScoreItem[];
}

interface Breakdown {
  is_gbp_only: boolean;
  categories: {
    onsite:   CategoryBreakdown;
    gbp:      CategoryBreakdown;
    local:    CategoryBreakdown;
    ranking:  CategoryBreakdown;
  };
  actions: string[];
}

interface HealthScore {
  id: string;
  client_id: string;
  score_total: number;
  score_onsite: number;
  score_gbp: number;
  score_local: number;
  score_ranking: number;
  breakdown: Breakdown;
  keywords_tracked: Array<{ keyword: string; rank: number | null; pts: number }>;
  scored_at: string;
}

interface HistoryPoint {
  score_total: number;
  score_onsite: number;
  score_gbp: number;
  score_local: number;
  score_ranking: number;
  scored_at: string;
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

function scoreColour(score: number): string {
  if (score >= 90) return '#d97706';  // gold
  if (score >= 75) return '#16a34a';  // green
  if (score >= 50) return '#f59e0b';  // amber
  return '#dc2626';                   // red
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

function catColour(pts: number, max: number): string {
  if (max === 0) return '#6b7280';
  const pct = pts / max;
  if (pct >= 0.85) return '#16a34a';
  if (pct >= 0.6)  return '#f59e0b';
  return '#dc2626';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CategoryCard({
  title,
  cat,
  defaultOpen = false,
}: {
  title: string;
  cat: CategoryBreakdown;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const pct = cat.max_pts > 0 ? Math.round((cat.pts / cat.max_pts) * 100) : 0;
  const col = catColour(cat.pts, cat.max_pts);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
          <span
            className="text-sm font-bold"
            style={{ color: col }}
          >
            {cat.pts}/{cat.max_pts}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mini progress bar */}
          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: col }}
            />
          </div>
          <span className="text-xs text-gray-500 w-7 text-right">{pct}%</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Item list */}
      {open && (
        <div className="divide-y divide-gray-50">
          {cat.items.map(item => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
              {item.pass
                ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                : item.pts > 0
                  ? <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{item.label}</p>
                {item.detail && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
                )}
              </div>
              <span
                className="text-xs font-semibold flex-shrink-0 ml-2"
                style={{ color: item.pts === item.max_pts ? '#16a34a' : item.pts > 0 ? '#f59e0b' : '#dc2626' }}
              >
                {item.pts}/{item.max_pts}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KeywordTable({ keywords }: { keywords: Array<{ keyword: string; rank: number | null; pts: number }> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-semibold text-gray-800 text-sm">Keyword Rankings ({keywords.length} tracked)</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div>
          <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Keyword</span>
            <span className="text-center">Rank</span>
            <span className="text-right">Points</span>
          </div>
          {keywords.map((k, i) => {
            const rankCol = k.rank == null ? '#9ca3af' : k.rank <= 3 ? '#16a34a' : k.rank <= 10 ? '#f59e0b' : '#dc2626';
            return (
              <div
                key={i}
                className="grid grid-cols-3 gap-2 px-4 py-2.5 border-b border-gray-50 last:border-0"
              >
                <span className="text-sm text-gray-700 truncate">{k.keyword}</span>
                <span
                  className="text-sm font-semibold text-center"
                  style={{ color: rankCol }}
                >
                  {k.rank != null ? `#${k.rank}` : '—'}
                </span>
                <span className="text-sm text-gray-600 text-right">{k.pts}pt</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sparkline({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) return null;

  const data = history.map(h => ({
    date: format(parseISO(h.scored_at), 'd MMM'),
    total: h.score_total,
    onsite: h.score_onsite,
    gbp: h.score_gbp,
    local: h.score_local,
    ranking: h.score_ranking,
  }));

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
        <TrendingUp className="w-4 h-4" /> Score Trend ({history.length} weeks)
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value: number) => [`${value}`, '']}
          />
          <Line type="monotone" dataKey="total" stroke="#1a2744" strokeWidth={2} dot={false} name="Total" />
          <Line type="monotone" dataKey="gbp" stroke="#E8622A" strokeWidth={1.5} dot={false} name="GBP" strokeDasharray="4 2" />
          <Line type="monotone" dataKey="local" stroke="#16a34a" strokeWidth={1.5} dot={false} name="Local" strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <TrendingUp className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">No score yet</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-xs">
        SEO health scores run automatically every Monday at 8am. Click to run one now.
      </p>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-2 bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#243461] transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        {refreshing ? 'Scoring…' : 'Score Now'}
      </button>
      {refreshing && (
        <p className="text-xs text-gray-400 mt-3">This takes ~60 seconds. Reload in a minute.</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  client: Client;
}

export default function SEOHealthTab({ client }: Props) {
  const [score, setScore] = useState<HealthScore | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/seo-health`);
      if (res.ok) {
        const data = await res.json();
        if (data.latest?.score_total != null) {
          setScore(data.latest);
        } else {
          setScore(null);
        }
        setHistory(data.history ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch(`/api/clients/${client.id}/seo-health`, { method: 'POST' });
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-32 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-32 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!score) {
    return (
      <div className="p-6">
        <EmptyState onRefresh={handleRefresh} refreshing={refreshing} />
      </div>
    );
  }

  const bd = score.breakdown;
  const cats = bd?.categories ?? {};
  const actions = bd?.actions ?? [];
  const isGbpOnly = bd?.is_gbp_only ?? false;
  const col = scoreColour(score.score_total);
  const scored = score.scored_at ? format(parseISO(score.scored_at), 'd MMM yyyy, h:mm a') : '';

  return (
    <div className="p-6 space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold" style={{ color: col }}>{score.score_total}</span>
            <span className="text-2xl text-gray-400 font-light">/100</span>
            <span
              className="text-sm font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${col}18`, color: col }}
            >
              {scoreLabel(score.score_total)}
            </span>
          </div>
          {scored && <p className="text-xs text-gray-400 mt-1">Last scored {scored}</p>}
          {isGbpOnly && (
            <p className="text-xs text-[#E8622A] mt-1">GBP-only client — website scoring skipped</p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Scoring…' : 'Refresh Score'}
        </button>
      </div>

      {/* 4 category cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'onsite',  label: 'On-Site SEO',   score: score.score_onsite  },
          { key: 'gbp',     label: 'GBP Profile',   score: score.score_gbp     },
          { key: 'local',   label: 'Local Presence', score: score.score_local   },
          { key: 'ranking', label: 'Rankings',       score: score.score_ranking },
        ].map(({ key, label, score: catScore }) => {
          const cat = cats[key as keyof typeof cats];
          const maxPts = cat?.max_pts ?? 0;
          const col2 = catColour(catScore, maxPts);
          const pct = maxPts > 0 ? Math.round(catScore / maxPts * 100) : 0;
          return (
            <div key={key} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-2xl font-bold" style={{ color: col2 }}>{catScore}</p>
              <p className="text-xs text-gray-400">/{maxPts} pts</p>
              <div className="w-full bg-gray-100 rounded-full h-1 mt-2">
                <div
                  className="h-1 rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: col2 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top 3 action items */}
      {actions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Top 3 Action Items</h3>
          <ol className="space-y-1.5">
            {actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                <span className="flex-shrink-0 w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold text-amber-800">
                  {i + 1}
                </span>
                {action}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Category breakdowns */}
      <div className="space-y-3">
        {!isGbpOnly && cats.onsite && (
          <CategoryCard title="On-Site SEO" cat={cats.onsite} />
        )}
        {cats.gbp && (
          <CategoryCard title="GBP Profile" cat={cats.gbp} defaultOpen />
        )}
        {cats.local && (
          <CategoryCard title="Local Presence" cat={cats.local} />
        )}
        {cats.ranking && (
          <CategoryCard title="Ranking Performance" cat={cats.ranking} />
        )}
      </div>

      {/* Keyword table */}
      {score.keywords_tracked?.length > 0 && (
        <KeywordTable keywords={score.keywords_tracked} />
      )}

      {/* Trend sparkline */}
      {history.length >= 2 && <Sparkline history={history} />}
    </div>
  );
}

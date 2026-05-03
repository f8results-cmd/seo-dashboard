'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Client } from '@/lib/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown, ChevronUp, Pencil, Trash2, ExternalLink } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Metric {
  id: string;
  client_id: string;
  month_year: string; // "2026-04"
  gbp_calls: number;
  gbp_website_clicks: number;
  gbp_profile_views: number;
  gbp_direction_requests: number;
  gbp_photo_views: number;
  gbp_messages: number;
  website_total_visits: number;
  website_unique_visitors: number;
  website_form_submissions: number;
  website_phone_clicks: number;
  notes: string | null;
}

interface GA4Status {
  ga4_configured: boolean;
  measurement_id: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMonthYear(my: string): string {
  // "2026-04" → "April 2026"
  const [year, month] = my.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

/** Generate last 24 months + current month in descending order */
function generateMonthOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < 25; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    options.push(`${year}-${month}`);
  }
  return options;
}

const MONTH_OPTIONS = generateMonthOptions();

const CHART_LINES: { key: keyof Metric; label: string; color: string }[] = [
  { key: 'gbp_calls', label: 'GBP Calls', color: '#E8622A' },
  { key: 'gbp_website_clicks', label: 'GBP Web Clicks', color: '#1a2744' },
  { key: 'gbp_profile_views', label: 'Profile Views', color: '#6366f1' },
  { key: 'website_form_submissions', label: 'Form Submissions', color: '#10b981' },
  { key: 'website_phone_clicks', label: 'Phone Clicks', color: '#f59e0b' },
];

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30';

// ── Comparison Card ────────────────────────────────────────────────────────────

function ComparisonCard({
  label,
  current,
  previous,
}: {
  label: string;
  current: number | null;
  previous: number | null;
}) {
  const delta =
    current !== null && previous !== null ? current - previous : null;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">{label}</p>
      <p className="text-3xl font-bold text-[#1a2744]">
        {current !== null ? current.toLocaleString() : '—'}
      </p>
      <div className="mt-1 h-5">
        {delta === null ? (
          <span className="text-xs text-gray-400">No comparison data</span>
        ) : delta === 0 ? (
          <span className="text-xs text-gray-500 font-medium">— No change</span>
        ) : delta > 0 ? (
          <span className="text-xs font-semibold text-green-600">▲ {delta.toLocaleString()} vs last month</span>
        ) : (
          <span className="text-xs font-semibold text-red-500">▼ {Math.abs(delta).toLocaleString()} vs last month</span>
        )}
      </div>
    </div>
  );
}

// ── Empty form state ───────────────────────────────────────────────────────────

const EMPTY_FORM = {
  month_year: MONTH_OPTIONS[0],
  gbp_calls: '',
  gbp_website_clicks: '',
  gbp_profile_views: '',
  gbp_direction_requests: '',
  gbp_photo_views: '',
  gbp_messages: '',
  website_total_visits: '',
  website_unique_visitors: '',
  website_form_submissions: '',
  website_phone_clicks: '',
  notes: '',
};

type FormState = typeof EMPTY_FORM;

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MonthlyMetricsTab({ client }: { client: Client }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [ga4Status, setGa4Status] = useState<GA4Status | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Chart line visibility
  const [visibleLines, setVisibleLines] = useState<Set<string>>(
    new Set(CHART_LINES.map(l => l.key as string))
  );

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, ga4Res] = await Promise.all([
        fetch(`${RAILWAY_URL}/monthly-metrics/${client.id}`),
        fetch(`${RAILWAY_URL}/website-analytics/${client.id}/summary`),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics ?? []);
      }

      if (ga4Res.ok) {
        const data = await ga4Res.json();
        setGa4Status(data);
      } else {
        setGa4Status({ ga4_configured: false, measurement_id: '' });
      }
    } catch (err) {
      console.error('Failed to load monthly metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  // ── Sorted metrics ────────────────────────────────────────────────────────────

  const sortedDesc = [...metrics].sort((a, b) => b.month_year.localeCompare(a.month_year));
  const sortedAsc = [...metrics].sort((a, b) => a.month_year.localeCompare(b.month_year)).slice(-12);

  const currentMonth = sortedDesc[0] ?? null;
  const previousMonth = sortedDesc[1] ?? null;

  // ── Chart data ────────────────────────────────────────────────────────────────

  const chartData = sortedAsc.map(m => ({
    month: formatMonthYear(m.month_year),
    gbp_calls: m.gbp_calls,
    gbp_website_clicks: m.gbp_website_clicks,
    gbp_profile_views: m.gbp_profile_views,
    website_form_submissions: m.website_form_submissions,
    website_phone_clicks: m.website_phone_clicks,
  }));

  // ── Form helpers ──────────────────────────────────────────────────────────────

  function setField(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function numField(label: string, key: keyof FormState) {
    return (
      <div>
        <label className="text-xs text-gray-500 mb-1 block">{label}</label>
        <input
          type="number"
          min="0"
          value={form[key]}
          onChange={e => setField(key, e.target.value)}
          placeholder="0"
          className={inputCls}
        />
      </div>
    );
  }

  function openEditForm(m: Metric) {
    setEditingId(m.id);
    setForm({
      month_year: m.month_year,
      gbp_calls: String(m.gbp_calls),
      gbp_website_clicks: String(m.gbp_website_clicks),
      gbp_profile_views: String(m.gbp_profile_views),
      gbp_direction_requests: String(m.gbp_direction_requests),
      gbp_photo_views: String(m.gbp_photo_views),
      gbp_messages: String(m.gbp_messages),
      website_total_visits: String(m.website_total_visits),
      website_unique_visitors: String(m.website_unique_visitors),
      website_form_submissions: String(m.website_form_submissions),
      website_phone_clicks: String(m.website_phone_clicks),
      notes: m.notes ?? '',
    });
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function clearForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSaveError('');
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const body = {
        month_year: form.month_year,
        gbp_calls: Number(form.gbp_calls) || 0,
        gbp_website_clicks: Number(form.gbp_website_clicks) || 0,
        gbp_profile_views: Number(form.gbp_profile_views) || 0,
        gbp_direction_requests: Number(form.gbp_direction_requests) || 0,
        gbp_photo_views: Number(form.gbp_photo_views) || 0,
        gbp_messages: Number(form.gbp_messages) || 0,
        website_total_visits: Number(form.website_total_visits) || 0,
        website_unique_visitors: Number(form.website_unique_visitors) || 0,
        website_form_submissions: Number(form.website_form_submissions) || 0,
        website_phone_clicks: Number(form.website_phone_clicks) || 0,
        notes: form.notes || null,
      };

      const res = await fetch(`${RAILWAY_URL}/monthly-metrics/${client.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      clearForm();
      setShowForm(false);
      await load();
    } catch (err) {
      setSaveError('Failed to save. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`${RAILWAY_URL}/monthly-metrics/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeletingId(null);
      await load();
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle chart line ─────────────────────────────────────────────────────────

  function toggleLine(key: string) {
    setVisibleLines(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Loading…</div>;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* Section 1: GA4 status banner */}
      {ga4Status !== null && (
        ga4Status.ga4_configured ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              GA4 connected: {ga4Status.measurement_id}
            </span>
            <a
              href="https://analytics.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#E8622A] hover:underline font-medium"
            >
              View GA4 Dashboard
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            GA4 not configured — add your Measurement ID in client settings to enable analytics tracking.
          </div>
        )
      )}

      {/* Section 2: Comparison cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ComparisonCard
          label="GBP Calls"
          current={currentMonth ? currentMonth.gbp_calls : null}
          previous={previousMonth ? previousMonth.gbp_calls : null}
        />
        <ComparisonCard
          label="Profile Views"
          current={currentMonth ? currentMonth.gbp_profile_views : null}
          previous={previousMonth ? previousMonth.gbp_profile_views : null}
        />
        <ComparisonCard
          label="Form Submissions"
          current={currentMonth ? currentMonth.website_form_submissions : null}
          previous={previousMonth ? previousMonth.website_form_submissions : null}
        />
        <ComparisonCard
          label="Phone Clicks"
          current={currentMonth ? currentMonth.website_phone_clicks : null}
          previous={previousMonth ? previousMonth.website_phone_clicks : null}
        />
      </div>

      {/* Section 3: Trend chart */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h3 className="text-sm font-semibold text-[#1a2744]">Trend (last 12 months)</h3>
          <div className="flex flex-wrap gap-2">
            {CHART_LINES.map(line => {
              const active = visibleLines.has(line.key as string);
              return (
                <button
                  key={line.key as string}
                  onClick={() => toggleLine(line.key as string)}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    active
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-500 border-gray-200'
                  }`}
                  style={active ? { backgroundColor: line.color, borderColor: line.color } : {}}
                >
                  {line.label}
                </button>
              );
            })}
          </div>
        </div>

        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {CHART_LINES.map(line =>
                visibleLines.has(line.key as string) ? (
                  <Line
                    key={line.key as string}
                    type="monotone"
                    dataKey={line.key as string}
                    name={line.label}
                    stroke={line.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Section 4: Add/Edit form */}
      <div ref={formRef} className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => {
            if (showForm) {
              clearForm();
            }
            setShowForm(prev => !prev);
          }}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
        >
          <span>{editingId ? 'Edit month data' : 'Add / Edit month'}</span>
          {showForm
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>

        {showForm && (
          <div className="p-5 border-t border-gray-200">
            <form onSubmit={handleSave} className="space-y-5">
              {/* Month picker */}
              <div className="max-w-xs">
                <label className="text-xs text-gray-500 mb-1 block">Month <span className="text-red-400">*</span></label>
                <select
                  value={form.month_year}
                  onChange={e => setField('month_year', e.target.value)}
                  className={inputCls}
                >
                  {MONTH_OPTIONS.map(my => (
                    <option key={my} value={my}>{formatMonthYear(my)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: GBP Metrics */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">GBP Metrics</p>
                  {numField('Calls', 'gbp_calls')}
                  {numField('Website Clicks', 'gbp_website_clicks')}
                  {numField('Profile Views', 'gbp_profile_views')}
                  {numField('Direction Requests', 'gbp_direction_requests')}
                  {numField('Photo Views', 'gbp_photo_views')}
                  {numField('Messages', 'gbp_messages')}
                </div>

                {/* Right: Website Metrics */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Website Metrics</p>
                  {numField('Total Visits', 'website_total_visits')}
                  {numField('Unique Visitors', 'website_unique_visitors')}
                  {numField('Form Submissions', 'website_form_submissions')}
                  {numField('Phone Clicks', 'website_phone_clicks')}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                  rows={3}
                  placeholder="Any context about this month's metrics…"
                  className={inputCls}
                />
              </div>

              {saveError && <p className="text-xs text-red-500">{saveError}</p>}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#E8622A] hover:bg-[#d4561f] text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={clearForm}
                  className="border border-gray-200 bg-white text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Clear form
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Section 5: Historical table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {sortedDesc.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            No metrics yet. Add your first month above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Month</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Calls</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Web Clicks</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Profile Views</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Form Subs</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone Clicks</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Notes</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedDesc.map(m => {
                  const isConfirmingDelete = deletingId === m.id;

                  return (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                        {formatMonthYear(m.month_year)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{m.gbp_calls.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">{m.gbp_website_clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">{m.gbp_profile_views.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{m.website_form_submissions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{m.website_phone_clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell max-w-[200px] truncate">
                        {m.notes ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openEditForm(m)}
                          className="text-gray-400 hover:text-[#1a2744] transition-colors p-1 rounded"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={() => handleDelete(m.id)}
                              disabled={deleting}
                              className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                            >
                              {deleting ? '…' : 'Yes, delete'}
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="text-xs text-gray-500 hover:text-gray-700 px-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(m.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

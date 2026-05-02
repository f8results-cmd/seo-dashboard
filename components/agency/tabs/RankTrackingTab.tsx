'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, ChevronDown, ChevronUp, Plus, Lightbulb, ExternalLink } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

// ── Types ──────────────────────────────────────────────────────────────────────

interface HistoryPoint {
  date: string;
  rank: number | null;
}

interface TopResult {
  position: number;
  title: string;
  link: string;
}

interface KeywordData {
  id: string;
  keyword: string;
  location: string | null;
  device: string;
  current_rank: number | null;
  previous_rank: number | null;
  change: number | null; // positive = improved (moved up toward rank 1)
  history: HistoryPoint[];
  top_3: TopResult[];
}

interface RankTrackingResponse {
  keywords: KeywordData[];
  last_scan: string | null;
}

interface SuggestResponse {
  keywords: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function rankBadgeCls(rank: number | null): string {
  if (rank === null) return 'bg-red-100 text-red-700';
  if (rank <= 3) return 'bg-green-100 text-green-700';
  if (rank <= 10) return 'bg-yellow-100 text-yellow-700';
  if (rank <= 20) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

function RankBadge({ rank }: { rank: number | null }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${rankBadgeCls(rank)}`}>
      {rank === null ? 'Not found' : `#${rank}`}
    </span>
  );
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null) return <span className="text-gray-400 text-xs">—</span>;
  if (change === 0) return <span className="text-gray-500 text-xs font-medium">=</span>;
  if (change > 0) {
    return (
      <span className="text-green-600 text-xs font-semibold">
        ▲{change}
      </span>
    );
  }
  return (
    <span className="text-red-500 text-xs font-semibold">
      ▼{Math.abs(change)}
    </span>
  );
}

// Sparkline: rank 1 = top of chart, rank 20 = bottom. Width 80px, height 24px.
// Null ranks break the polyline into segments.
function Sparkline({ history }: { history: HistoryPoint[] }) {
  const points = history.slice(-30);
  if (points.length < 2) return <span className="text-gray-300 text-xs">—</span>;

  const W = 80;
  const H = 24;
  const MAX_RANK = 20;
  const MIN_RANK = 1;

  // Build segments (arrays of consecutive non-null points)
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];

  points.forEach((p, i) => {
    const x = points.length === 1 ? W / 2 : (i / (points.length - 1)) * W;
    if (p.rank === null) {
      if (current.length >= 2) segments.push(current);
      current = [];
    } else {
      const clampedRank = Math.min(Math.max(p.rank, MIN_RANK), MAX_RANK);
      // rank 1 → y = 2 (top), rank 20 → y = H-2 (bottom)
      const y = 2 + ((clampedRank - MIN_RANK) / (MAX_RANK - MIN_RANK)) * (H - 4);
      current.push({ x, y });
    }
  });
  if (current.length >= 2) segments.push(current);

  if (segments.length === 0) return <span className="text-gray-300 text-xs">—</span>;

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      {segments.map((seg, si) => (
        <polyline
          key={si}
          points={seg.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30';

// ── Main component ─────────────────────────────────────────────────────────────

export default function RankTrackingTab({ clientId }: { clientId: string }) {
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  // Expanded rows
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add keyword form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addKeyword, setAddKeyword] = useState('');
  const [addLocation, setAddLocation] = useState('');
  const [addDevice, setAddDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Suggestions
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestError, setSuggestError] = useState('');

  // ── Data fetching ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${RAILWAY_URL}/rank-tracking/${clientId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RankTrackingResponse = await res.json();
      setKeywords(data.keywords ?? []);
      setLastScan(data.last_scan ?? null);
    } catch (err) {
      console.error('Failed to load rank tracking data:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  // ── Scan Now ─────────────────────────────────────────────────────────────────

  async function handleScan() {
    setScanning(true);
    setScanError('');
    try {
      const res = await fetch(`${RAILWAY_URL}/rank-tracking/scan/${clientId}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setScanError('Scan failed. Please try again.');
      console.error(err);
    } finally {
      setScanning(false);
    }
  }

  // ── Add keyword ───────────────────────────────────────────────────────────────

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!addKeyword.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch(`${RAILWAY_URL}/rank-tracking/keywords/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: addKeyword.trim(),
          location: addLocation.trim() || null,
          device: addDevice,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAddKeyword('');
      setAddLocation('');
      setAddDevice('desktop');
      setShowAddForm(false);
      await load();
    } catch (err) {
      setAddError('Failed to add keyword. Please try again.');
      console.error(err);
    } finally {
      setAdding(false);
    }
  }

  // ── Add from suggestion ───────────────────────────────────────────────────────

  async function addSuggestion(kw: string) {
    try {
      const res = await fetch(`${RAILWAY_URL}/rank-tracking/keywords/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: kw,
          location: addLocation.trim() || null,
          device: addDevice,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuggestions(prev => prev.filter(s => s !== kw));
      await load();
    } catch (err) {
      console.error('Failed to add suggested keyword:', err);
    }
  }

  // ── Delete keyword ────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${RAILWAY_URL}/rank-tracking/keywords/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setKeywords(prev => prev.filter(k => k.id !== id));
    } catch (err) {
      console.error('Failed to delete keyword:', err);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Suggest keywords ──────────────────────────────────────────────────────────

  async function handleSuggest() {
    setSuggesting(true);
    setSuggestError('');
    setSuggestions([]);
    try {
      const res = await fetch(`${RAILWAY_URL}/rank-tracking/suggest-keywords/${clientId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SuggestResponse = await res.json();
      setSuggestions(data.keywords ?? []);
    } catch (err) {
      setSuggestError('Failed to fetch suggestions.');
      console.error(err);
    } finally {
      setSuggesting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-5">

      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          {lastScan ? (
            <>Last scan: <span className="text-gray-700 font-medium">{formatDate(lastScan)}</span></>
          ) : (
            <span className="text-gray-400">Never scanned</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {scanError && <span className="text-xs text-red-500">{scanError}</span>}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#243460] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning…' : 'Scan Now'}
          </button>
        </div>
      </div>

      {/* Keyword table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {keywords.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            No keywords tracked yet — add keywords below.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Keyword</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Location</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rank</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Change</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Trend</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keywords.map(kw => {
                const isExpanded = expandedId === kw.id;
                const isDeleting = deletingId === kw.id;

                return (
                  <>
                    <tr
                      key={kw.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : kw.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          }
                          <span className="font-medium text-gray-900">{kw.keyword}</span>
                          <span className="text-xs text-gray-400 capitalize hidden lg:inline">({kw.device})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {kw.location ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <RankBadge rank={kw.current_rank} />
                      </td>
                      <td className="px-4 py-3">
                        <ChangeBadge change={kw.change} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Sparkline history={kw.history} />
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setDeletingId(isDeleting ? null : kw.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded"
                          title="Remove keyword"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* Delete confirmation row */}
                    {isDeleting && (
                      <tr key={`${kw.id}-delete`} className="bg-red-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-red-700">Remove &ldquo;{kw.keyword}&rdquo;?</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setDeletingId(null)}
                                className="border border-gray-200 bg-white text-gray-600 px-3 py-1 rounded-lg text-xs hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDelete(kw.id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${kw.id}-expanded`} className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                            {/* Rank history */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Rank History
                              </p>
                              {kw.history.length === 0 ? (
                                <p className="text-xs text-gray-400">No history yet.</p>
                              ) : (
                                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                  {[...kw.history].reverse().map((h, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                                      <span>{formatDate(h.date)}</span>
                                      <RankBadge rank={h.rank} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Top 3 competitors */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Top Results
                              </p>
                              {kw.top_3.length === 0 ? (
                                <p className="text-xs text-gray-400">No data available.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {kw.top_3.map((result, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                      <span className="text-xs font-semibold text-gray-400 w-4 shrink-0 pt-0.5">
                                        {result.position}.
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-xs text-gray-700 font-medium truncate">{result.title}</p>
                                        <a
                                          href={result.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={e => e.stopPropagation()}
                                          className="text-xs text-blue-500 hover:underline flex items-center gap-0.5 truncate"
                                        >
                                          <span className="truncate">{result.link}</span>
                                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add keyword section */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => {
            setShowAddForm(prev => !prev);
            setSuggestions([]);
            setSuggestError('');
          }}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Add keyword
          </span>
          {showAddForm
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>

        {showAddForm && (
          <div className="p-4 space-y-4 border-t border-gray-200">
            <form onSubmit={handleAddKeyword} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Keyword <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={addKeyword}
                    onChange={e => setAddKeyword(e.target.value)}
                    placeholder="e.g. plumber Adelaide"
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Location</label>
                  <input
                    value={addLocation}
                    onChange={e => setAddLocation(e.target.value)}
                    placeholder="e.g. Adelaide, SA"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Device</label>
                  <select
                    value={addDevice}
                    onChange={e => setAddDevice(e.target.value as 'desktop' | 'mobile')}
                    className={inputCls}
                  >
                    <option value="desktop">Desktop</option>
                    <option value="mobile">Mobile</option>
                  </select>
                </div>
              </div>

              {addError && <p className="text-xs text-red-500">{addError}</p>}

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="submit"
                  disabled={adding || !addKeyword.trim()}
                  className="bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#243460] transition-colors disabled:opacity-40"
                >
                  {adding ? 'Adding…' : 'Add keyword'}
                </button>
                <button
                  type="button"
                  onClick={handleSuggest}
                  disabled={suggesting}
                  className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-[#E8622A]" />
                  {suggesting ? 'Fetching…' : 'Suggest keywords'}
                </button>
              </div>
            </form>

            {/* Suggestions dropdown */}
            {suggestError && (
              <p className="text-xs text-red-500">{suggestError}</p>
            )}

            {suggestions.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 bg-gray-50 border-b border-gray-200">
                  AI Suggestions — click to add
                </p>
                <div className="divide-y divide-gray-100">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => addSuggestion(s)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#E8622A]/5 hover:text-[#E8622A] transition-colors flex items-center justify-between group"
                    >
                      <span>{s}</span>
                      <Plus className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#E8622A] transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

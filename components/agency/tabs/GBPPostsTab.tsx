'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ExternalLink, Pencil, X } from 'lucide-react';
import type { Client, GbpPost, PostStatus } from '@/lib/types';

const STATUS_STYLES: Record<PostStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  posted:    'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface PostingSchedule {
  posts_per_week: number;
  preferred_days: string[];
  preferred_time: string;
  reasoning: string;
}

function SchedulePanel({ clientId, initial }: { clientId: string; initial: PostingSchedule | null }) {
  const defaultSchedule: PostingSchedule = {
    posts_per_week: 1,
    preferred_days: ['Wednesday'],
    preferred_time: '09:00',
    reasoning: '',
  };
  const [schedule, setSchedule] = useState<PostingSchedule>(initial ?? defaultSchedule);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<PostingSchedule>(schedule);
  const [saving, setSaving]   = useState(false);

  function openEdit() { setDraft({ ...schedule }); setEditing(true); }
  function toggleDay(day: string) {
    setDraft(prev => {
      const has = prev.preferred_days.includes(day);
      let days = has
        ? prev.preferred_days.filter(d => d !== day)
        : [...prev.preferred_days, day];
      // Clamp to posts_per_week
      if (days.length > prev.posts_per_week) days = days.slice(-prev.posts_per_week);
      return { ...prev, preferred_days: days };
    });
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gbp_posting_schedule: draft }),
    });
    if (res.ok) { setSchedule(draft); setEditing(false); }
    setSaving(false);
  }

  return (
    <div className="border border-blue-100 rounded-lg bg-blue-50 p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-blue-900 mb-1">Posting Schedule</p>
          {editing ? (
            <div className="space-y-3 mt-2">
              <div className="flex items-center gap-3">
                <label className="text-xs text-blue-700 w-28">Posts per week</label>
                <select
                  value={draft.posts_per_week}
                  onChange={e => setDraft(prev => ({ ...prev, posts_per_week: Number(e.target.value), preferred_days: prev.preferred_days.slice(0, Number(e.target.value)) }))}
                  className="text-xs border border-blue-200 rounded px-2 py-1 bg-white"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-xs text-blue-700 w-28 mt-0.5">Preferred days</label>
                <div className="flex flex-wrap gap-1">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        draft.preferred_days.includes(day)
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-blue-700 w-28">Preferred time</label>
                <input
                  type="time"
                  value={draft.preferred_time}
                  onChange={e => setDraft(prev => ({ ...prev, preferred_time: e.target.value }))}
                  className="text-xs border border-blue-200 rounded px-2 py-1 bg-white"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-blue-700 w-28">Reasoning</label>
                <input
                  type="text"
                  value={draft.reasoning}
                  onChange={e => setDraft(prev => ({ ...prev, reasoning: e.target.value }))}
                  placeholder="Optional note"
                  className="text-xs border border-blue-200 rounded px-2 py-1 bg-white flex-1"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={save}
                  disabled={saving || draft.preferred_days.length === 0}
                  className="px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1 rounded text-xs font-medium bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-blue-700 space-y-0.5">
              <p>{schedule.posts_per_week}x per week — {schedule.preferred_days.join(' & ')} at {schedule.preferred_time}</p>
              {schedule.reasoning && <p className="text-xs text-blue-500 italic">{schedule.reasoning}</p>}
            </div>
          )}
        </div>
        {!editing && (
          <button
            onClick={openEdit}
            className="shrink-0 px-2.5 py-1 rounded text-xs font-medium bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function escapeCsvCell(value: string): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getPostLink(client: Pick<Client, 'live_url' | 'website_url'>): string {
  // Prefer live_url; fall back to website_url only if it's not a vercel.app URL
  if (client.live_url && client.live_url.trim()) return client.live_url.trim();
  if (client.website_url && !client.website_url.includes('vercel.app')) return client.website_url.trim();
  return '';
}

function buildGhlCsv(posts: GbpPost[], client: Pick<Client, 'live_url' | 'website_url'>): string {
  // GHL Social Planner — Basic Format, CRLF line endings, no BOM
  // Headers must include parenthetical hints exactly as GHL requires
  const header = [
    'postAtSpecificTime (YYYY-MM-DD HH:mm:ss)',
    'content',
    'link (OGmetaUrl)',
    'imageUrls',
    'gifUrl',
    'videoUrls',
  ];

  const link = getPostLink(client);

  const rows = posts.map((p) => {
    const dt     = p.scheduled_date ? parseISO(p.scheduled_date) : null;
    const postAt = dt ? format(dt, 'yyyy-MM-dd HH:mm:ss') : '';
    return [
      postAt,
      p.content,
      link, // link (OGmetaUrl)
      '',   // imageUrls
      '',   // gifUrl
      '',   // videoUrls
    ];
  });

  return [header, ...rows].map(row => row.map(escapeCsvCell).join(',')).join('\r\n') + '\r\n';
}

// ── Date-range bulk scheduler ────────────────────────────────────────────────
function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

export default function GBPPostsTab({ client }: { client: Client }) {
  const clientId = client.id;
  const [posts, setPosts]         = useState<GbpPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<PostStatus | 'all'>('all');

  // GHL Social Planner URL
  const [ghlUrl, setGhlUrl]         = useState(client.ghl_social_planner_url ?? '');
  const [editingGhl, setEditingGhl] = useState(false);
  const [ghlDraft, setGhlDraft]     = useState('');
  const [ghlSaving, setGhlSaving]   = useState(false);

  async function saveGhlUrl() {
    setGhlSaving(true);
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ghl_social_planner_url: ghlDraft.trim() || null }),
    });
    if (res.ok) {
      setGhlUrl(ghlDraft.trim());
      setEditingGhl(false);
    }
    setGhlSaving(false);
  }

  // selection — plain object avoids Set iteration (TS downlevel compat)
  const [selected, setSelected]   = useState<Record<string, boolean>>({});

  // edit modal
  const [editing, setEditing]     = useState<GbpPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate]   = useState('');
  const [editTime, setEditTime]   = useState('09:00');
  const [editSaving, setEditSaving] = useState(false);

  // bulk schedule modal
  const [bulkScheduling, setBulkScheduling] = useState(false);
  const [bulkStart, setBulkStart] = useState('');
  const [bulkTime, setBulkTime]   = useState('09:00');
  const [bulkSaving, setBulkSaving] = useState(false);

  // copy feedback
  const [copiedId, setCopiedId]   = useState<string | null>(null);

  const filteredPosts = filter === 'all' ? posts : posts.filter(p => p.status === filter);
  const filteredIds   = filteredPosts.map(p => p.id);

  const counts = {
    all: posts.length,
    pending:   posts.filter(p => p.status === 'pending').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    posted:    posts.filter(p => p.status === 'posted').length,
    failed:    posts.filter(p => p.status === 'failed').length,
  };

  const weekIndex = new Map(posts.map((p, i) => [p.id, i + 1]));

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/gbp-posts/${clientId}`);
    const data = await res.json();
    setPosts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  // ── Single post PATCH ─────────────────────────────────────────────────────
  async function patchPost(id: string, fields: Partial<GbpPost>) {
    const res = await fetch(`/api/gbp-posts/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
    return res.ok;
  }

  // ── Single post DELETE ────────────────────────────────────────────────────
  async function deletePost(id: string) {
    await fetch(`/api/gbp-posts/${clientId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setPosts(prev => prev.filter(p => p.id !== id));
    setSelected(prev => { const s = { ...prev }; delete s[id]; return s; });
  }

  // ── Bulk DELETE ───────────────────────────────────────────────────────────
  async function bulkDelete() {
    const ids = filteredIds.filter(id => selected[id]);
    if (!ids.length || !confirm(`Delete ${ids.length} post${ids.length > 1 ? 's' : ''}?`)) return;
    await fetch(`/api/gbp-posts/${clientId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setPosts(prev => prev.filter(p => !ids.includes(p.id)));
    setSelected({});
  }

  // ── Bulk mark posted ──────────────────────────────────────────────────────
  async function bulkMarkPosted() {
    const ids = filteredIds.filter(id => selected[id]);
    if (!ids.length) return;
    await Promise.all(ids.map(id => patchPost(id, { status: 'posted' })));
    setPosts(prev => prev.map(p => ids.includes(p.id) ? { ...p, status: 'posted' } : p));
    setSelected({});
  }

  // ── Bulk schedule ─────────────────────────────────────────────────────────
  async function confirmBulkSchedule() {
    const ids = filteredIds.filter(id => selected[id]);
    if (!ids.length || !bulkStart) return;
    setBulkSaving(true);
    const start = new Date(`${bulkStart}T${bulkTime}:00`);
    await Promise.all(ids.map((id, i) => {
      const dt = addWeeks(start, i);
      const iso = dt.toISOString();
      return patchPost(id, { scheduled_date: iso, status: 'scheduled' });
    }));
    await load();
    setBulkScheduling(false);
    setBulkStart('');
    setBulkSaving(false);
    setSelected({});
  }

  // ── Bulk CSV export ───────────────────────────────────────────────────────
  function exportCsv(idsToExport?: string[]) {
    const subset = idsToExport
      ? posts.filter(p => idsToExport.includes(p.id))
      : filteredPosts;
    if (!subset.length) return;
    const csv = buildGhlCsv(subset, client);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gbp-posts-${clientId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Copy ──────────────────────────────────────────────────────────────────
  async function copyPost(e: React.MouseEvent, post: GbpPost) {
    e.stopPropagation();
    await navigator.clipboard.writeText(post.content);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // ── Edit modal open ───────────────────────────────────────────────────────
  function openEdit(post: GbpPost) {
    setEditing(post);
    setEditContent(post.content);
    if (post.scheduled_date) {
      const dt = parseISO(post.scheduled_date);
      setEditDate(format(dt, 'yyyy-MM-dd'));
      setEditTime(format(dt, 'HH:mm'));
    } else {
      setEditDate('');
      setEditTime('09:00');
    }
  }

  // ── Edit modal save ───────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);
    const scheduled_date = editDate
      ? new Date(`${editDate}T${editTime}:00`).toISOString()
      : null;
    const ok = await patchPost(editing.id, { content: editContent, scheduled_date });
    if (ok) {
      setPosts(prev => prev.map(p =>
        p.id === editing.id ? { ...p, content: editContent, scheduled_date: scheduled_date ?? p.scheduled_date } : p
      ));
      setEditing(null);
    }
    setEditSaving(false);
  }

  // ── Mark posted (from edit modal) ─────────────────────────────────────────
  async function markPosted(id: string) {
    const ok = await patchPost(id, { status: 'posted' });
    if (ok) {
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'posted' } : p));
      setEditing(null);
    }
  }

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => !!selected[id]);

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected(prev => {
        const s = { ...prev };
        filteredIds.forEach(id => { delete s[id]; });
        return s;
      });
    } else {
      setSelected(prev => {
        const s = { ...prev };
        filteredIds.forEach(id => { s[id] = true; });
        return s;
      });
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const s = { ...prev };
      s[id] ? delete s[id] : (s[id] = true);
      return s;
    });
  }

  const selectionInFilter = filteredIds.filter(id => !!selected[id]);
  const selCount = selectionInFilter.length;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 bg-gray-200 rounded w-28" />
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => <div key={i} className="h-7 bg-gray-200 rounded w-20" />)}
        </div>
      </div>
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex gap-4 py-2 border-b border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-4" />
            <div className="h-4 bg-gray-200 rounded w-6" />
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded flex-1" />
            <div className="h-4 bg-gray-200 rounded-full w-16" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-4">

      {/* ── GHL Social Planner link ── */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm">GHL Social Planner</h3>
        {!editingGhl ? (
          ghlUrl ? (
            <div className="flex items-center gap-3">
              <a
                href={ghlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#1a2744] hover:bg-[#243561] rounded-lg px-4 py-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in GHL
              </a>
              <button
                onClick={() => { setGhlDraft(ghlUrl); setEditingGhl(true); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                title="Edit URL"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={ghlDraft}
                onChange={e => setGhlDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveGhlUrl(); }}
                placeholder="Paste GHL Social Planner URL"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30"
              />
              <button
                onClick={saveGhlUrl}
                disabled={!ghlDraft.trim() || ghlSaving}
                className="text-sm font-medium text-white bg-[#1a2744] hover:bg-[#243561] rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {ghlSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="url"
              value={ghlDraft}
              onChange={e => setGhlDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveGhlUrl(); if (e.key === 'Escape') setEditingGhl(false); }}
              placeholder="Paste GHL Social Planner URL"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30"
            />
            <button
              onClick={saveGhlUrl}
              disabled={!ghlDraft.trim() || ghlSaving}
              className="text-sm font-medium text-white bg-[#1a2744] hover:bg-[#243561] rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {ghlSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditingGhl(false); setGhlDraft(''); }}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Posting schedule ── */}
      <SchedulePanel
        clientId={clientId}
        initial={client.gbp_posting_schedule ?? null}
      />

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold text-gray-900">{posts.length} / 52 Posts</h2>

          {/* Export all visible */}
          <button
            onClick={() => exportCsv()}
            disabled={filteredPosts.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>

          {/* Bulk action bar — only when something selected */}
          {selCount > 0 && (
            <div className="flex items-center gap-1 pl-2 border-l border-gray-200">
              <span className="text-xs text-gray-500 mr-1">{selCount} selected</span>
              <button
                onClick={() => exportCsv(selectionInFilter)}
                className="px-2.5 py-1.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                Export selected
              </button>
              <button
                onClick={() => setBulkScheduling(true)}
                className="px-2.5 py-1.5 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Schedule
              </button>
              <button
                onClick={bulkMarkPosted}
                className="px-2.5 py-1.5 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                Mark posted
              </button>
              <button
                onClick={bulkDelete}
                className="px-2.5 py-1.5 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1 flex-wrap">
          {(['all', 'pending', 'scheduled', 'posted', 'failed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize
                ${filter === f ? 'bg-[#1a2744] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {filteredPosts.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No posts found.</p>
      )}

      {/* ── Table ── */}
      {filteredPosts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 pr-2 w-6">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className="accent-[#1B2B6B] cursor-pointer"
                  />
                </th>
                <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium w-10">Wk</th>
                <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium whitespace-nowrap">Date</th>
                <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium">Preview</th>
                <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium whitespace-nowrap">Type</th>
                <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPosts.map((post) => (
                <tr
                  key={post.id}
                  onClick={() => openEdit(post)}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${!!selected[post.id] ? 'bg-blue-50' : ''}`}
                >
                  <td className="py-3 pr-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!selected[post.id]}
                      onChange={() => toggleOne(post.id)}
                      className="accent-[#1B2B6B] cursor-pointer"
                    />
                  </td>
                  <td className="py-3 pr-4 text-gray-400 text-xs">{weekIndex.get(post.id)}</td>
                  <td className="py-3 pr-4 text-gray-600 whitespace-nowrap text-xs">
                    {post.scheduled_date ? format(parseISO(post.scheduled_date), 'd MMM yyyy') : '—'}
                  </td>
                  <td className="py-3 pr-4 text-gray-700 max-w-xs truncate">
                    {post.content.slice(0, 100)}
                  </td>
                  <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                    {post.post_type ?? '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[post.status]}`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="py-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => copyPost(e, post)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors
                        ${copiedId === post.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {copiedId === post.id ? 'Copied!' : 'Copy'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  Week {weekIndex.get(editing.id)} — Edit Post
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[editing.status]}`}>
                  {editing.status}
                </span>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* Content */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Post content</label>
              <textarea
                rows={7}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B2B6B] resize-y"
              />
              <p className="text-xs text-gray-400 mt-0.5 text-right">{editContent.length} chars</p>
            </div>

            {/* Schedule date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Schedule date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={e => setEditTime(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex gap-2">
                {editing.status !== 'posted' && (
                  <button
                    onClick={() => markPosted(editing.id)}
                    className="px-3 py-1.5 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                  >
                    Mark posted
                  </button>
                )}
                <button
                  onClick={() => { deletePost(editing.id); setEditing(null); }}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 py-1.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="px-4 py-1.5 rounded text-xs font-medium bg-[#1B2B6B] text-white hover:bg-[#152258] disabled:opacity-60 transition-colors"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk schedule modal ── */}
      {bulkScheduling && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setBulkScheduling(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Bulk schedule {selCount} post{selCount > 1 ? 's' : ''}</p>
              <button onClick={() => setBulkScheduling(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <p className="text-xs text-gray-500">
              Posts will be spaced one week apart starting from the date below.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
                <input
                  type="date"
                  value={bulkStart}
                  onChange={e => setBulkStart(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Time (each post)</label>
                <input
                  type="time"
                  value={bulkTime}
                  onChange={e => setBulkTime(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setBulkScheduling(false)}
                className="px-4 py-1.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkSchedule}
                disabled={!bulkStart || bulkSaving}
                className="px-4 py-1.5 rounded text-xs font-medium bg-[#1B2B6B] text-white hover:bg-[#152258] disabled:opacity-60 transition-colors"
              >
                {bulkSaving ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

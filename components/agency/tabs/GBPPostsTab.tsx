'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import type { GbpPost, PostStatus } from '@/lib/types';

const STATUS_STYLES: Record<PostStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  posted:    'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
};

function escapeCsvCell(value: string): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildGhlCsv(posts: GbpPost[], locationId: string): string {
  const header = ['Message', 'Schedule Date', 'Schedule Time', 'Post Type', 'Media URL', 'Location ID'];
  const rows = posts.map((p) => {
    const dt = p.scheduled_date ? parseISO(p.scheduled_date) : null;
    return [
      p.content,
      dt ? format(dt, 'MM/dd/yyyy') : '',
      dt ? format(dt, 'HH:mm') : '',
      p.post_type ?? '',
      '',
      locationId,
    ];
  });
  return [header, ...rows].map(row => row.map(escapeCsvCell).join(',')).join('\n');
}

// ── Date-range bulk scheduler ────────────────────────────────────────────────
function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

export default function GBPPostsTab({ clientId, locationId = '' }: { clientId: string; locationId?: string }) {
  const [posts, setPosts]         = useState<GbpPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<PostStatus | 'all'>('all');

  // selection
  const [selected, setSelected]   = useState<Set<string>>(new Set());

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
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  // ── Bulk DELETE ───────────────────────────────────────────────────────────
  async function bulkDelete() {
    const ids = [...selected].filter(id => filteredIds.includes(id));
    if (!ids.length || !confirm(`Delete ${ids.length} post${ids.length > 1 ? 's' : ''}?`)) return;
    await fetch(`/api/gbp-posts/${clientId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setPosts(prev => prev.filter(p => !ids.includes(p.id)));
    setSelected(new Set());
  }

  // ── Bulk mark posted ──────────────────────────────────────────────────────
  async function bulkMarkPosted() {
    const ids = [...selected].filter(id => filteredIds.includes(id));
    if (!ids.length) return;
    await Promise.all(ids.map(id => patchPost(id, { status: 'posted' })));
    setPosts(prev => prev.map(p => ids.includes(p.id) ? { ...p, status: 'posted' } : p));
    setSelected(new Set());
  }

  // ── Bulk schedule ─────────────────────────────────────────────────────────
  async function confirmBulkSchedule() {
    const ids = [...selected].filter(id => filteredIds.includes(id));
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
    setSelected(new Set());
  }

  // ── Bulk CSV export ───────────────────────────────────────────────────────
  function exportCsv(idsToExport?: string[]) {
    const subset = idsToExport
      ? posts.filter(p => idsToExport.includes(p.id))
      : filteredPosts;
    if (!subset.length) return;
    const csv = buildGhlCsv(subset, locationId);
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
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected(prev => {
        const s = new Set(prev);
        filteredIds.forEach(id => s.delete(id));
        return s;
      });
    } else {
      setSelected(prev => new Set([...prev, ...filteredIds]));
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  const selectionInFilter = filteredIds.filter(id => selected.has(id));
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
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected.has(post.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="py-3 pr-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(post.id)}
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

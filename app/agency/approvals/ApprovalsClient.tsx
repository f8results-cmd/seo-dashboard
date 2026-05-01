'use client';

import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle, XCircle, Send, Edit3, ChevronDown, ChevronUp, Clock, FileText, MessageSquare, Camera, BarChart2, RefreshCw } from 'lucide-react';
import type { ApprovalQueueItem, ApprovalActionType } from '@/lib/types';

const ACTION_ICONS: Record<ApprovalActionType, React.ReactNode> = {
  gbp_post:       <FileText   className="w-4 h-4 text-blue-500" />,
  review_reply:   <MessageSquare className="w-4 h-4 text-green-500" />,
  monthly_report: <BarChart2  className="w-4 h-4 text-purple-500" />,
  photo_reminder: <Camera     className="w-4 h-4 text-amber-500" />,
  friday_update:  <Send       className="w-4 h-4 text-indigo-500" />,
};

const ACTION_LABELS: Record<ApprovalActionType, string> = {
  gbp_post:       'GBP Post',
  review_reply:   'Review Reply',
  monthly_report: 'Monthly Report',
  photo_reminder: 'Photo Reminder',
  friday_update:  'Friday Update',
};

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-blue-100 text-blue-700',
  rejected:  'bg-red-100 text-red-700',
  published: 'bg-green-100 text-green-700',
  error:     'bg-red-100 text-red-700',
};

function getPreview(item: ApprovalQueueItem): string {
  const d = item.edited_content ?? item.content_data;
  const text = (d as Record<string, unknown>)['post_text'] as string
    ?? (d as Record<string, unknown>)['draft_response'] as string
    ?? (d as Record<string, unknown>)['body'] as string
    ?? '';
  return text.slice(0, 220) + (text.length > 220 ? '…' : '');
}

function getFullText(item: ApprovalQueueItem): string {
  const d = item.edited_content ?? item.content_data;
  return (
    (d as Record<string, unknown>)['post_text'] as string
    ?? (d as Record<string, unknown>)['draft_response'] as string
    ?? (d as Record<string, unknown>)['body'] as string
    ?? JSON.stringify(d, null, 2)
  );
}

interface Props { initialItems: ApprovalQueueItem[] }

export default function ApprovalsClient({ initialItems }: Props) {
  const [items, setItems]             = useState<ApprovalQueueItem[]>(initialItems);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterType, setFilterType]     = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [expanded, setExpanded]         = useState<Set<string>>(new Set());
  const [editing, setEditing]           = useState<Record<string, string>>({});
  const [working, setWorking]           = useState<Set<string>>(new Set());
  const [msg, setMsg]                   = useState<Record<string, string>>({});
  const [refreshing, setRefreshing]     = useState(false);

  const pendingCount = items.filter(i => i.status === 'pending').length;

  const clients = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const item of items) {
      if (!seen.has(item.client_id)) {
        seen.add(item.client_id);
        list.push({ id: item.client_id, name: item.clients?.business_name ?? item.client_id });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(() => items.filter(i => {
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterType && i.action_type !== filterType) return false;
    if (filterClient && i.client_id !== filterClient) return false;
    return true;
  }), [items, filterStatus, filterType, filterClient]);

  async function refresh() {
    setRefreshing(true);
    try {
      // Re-fetch from server
      const res = await fetch('/agency/approvals?_refresh=1');
      if (res.ok) window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function setItemMsg(id: string, m: string) {
    setMsg(prev => ({ ...prev, [id]: m }));
  }

  function setItemWorking(id: string, on: boolean) {
    setWorking(prev => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function patchItem(id: string, patch: Partial<ApprovalQueueItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }

  async function callAction(itemId: string, action: string, body?: object) {
    setItemWorking(itemId, true);
    setItemMsg(itemId, '');
    try {
      const res = await fetch(`/api/approval-queue/${itemId}?action=${action}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItemMsg(itemId, data.detail ?? data.error ?? `Error ${res.status}`);
        return false;
      }
      return data;
    } catch (e) {
      setItemMsg(itemId, String(e));
      return false;
    } finally {
      setItemWorking(itemId, false);
    }
  }

  async function approve(item: ApprovalQueueItem) {
    const ok = await callAction(item.id, 'approve');
    if (ok) {
      patchItem(item.id, { status: 'approved', approved_at: new Date().toISOString() });
      setItemMsg(item.id, 'Approved.');
    }
  }

  async function reject(item: ApprovalQueueItem) {
    const reason = window.prompt('Rejection reason (optional):') ?? 'Rejected by operator';
    const ok = await callAction(item.id, 'reject', { reason });
    if (ok) {
      patchItem(item.id, { status: 'rejected', reject_reason: reason });
      setItemMsg(item.id, 'Rejected.');
    }
  }

  async function saveEdit(item: ApprovalQueueItem) {
    const text = editing[item.id] ?? '';
    const key = item.action_type === 'gbp_post' ? 'post_text'
      : item.action_type === 'review_reply' ? 'draft_response'
      : 'body';
    const newContent = { ...(item.content_data as Record<string, unknown>), [key]: text };
    const ok = await callAction(item.id, 'edit', { content: newContent });
    if (ok) {
      patchItem(item.id, { edited_content: newContent as Record<string, unknown> });
      setEditing(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      setItemMsg(item.id, 'Edit saved.');
    }
  }

  async function publish(item: ApprovalQueueItem) {
    const ok = await callAction(item.id, 'publish');
    if (ok) {
      patchItem(item.id, { status: 'published', published_at: new Date().toISOString(), publish_result: ok.result });
      setItemMsg(item.id, `Published: ${ok.result}`);
    }
  }

  async function approveAndPublish(item: ApprovalQueueItem) {
    const ok = await callAction(item.id, 'approve-and-publish');
    if (ok) {
      patchItem(item.id, { status: 'published', published_at: new Date().toISOString(), publish_result: ok.result });
      setItemMsg(item.id, `Published: ${ok.result}`);
    }
  }

  async function bulkApproveClient(clientId: string) {
    const pending = filtered.filter(i => i.client_id === clientId && i.status === 'pending');
    for (const item of pending) await approve(item);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pendingCount} item{pendingCount !== 1 ? 's' : ''} awaiting approval</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none"
        >
          <option value="">All types</option>
          <option value="gbp_post">GBP Posts</option>
          <option value="review_reply">Review Replies</option>
          <option value="monthly_report">Monthly Reports</option>
          <option value="photo_reminder">Photo Reminders</option>
          <option value="friday_update">Friday Updates</option>
        </select>
        <select
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none"
        >
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No items match these filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const isExpanded = expanded.has(item.id);
            const isWorking = working.has(item.id);
            const editText = editing[item.id];
            const fullText = getFullText(item);
            const preview = getPreview(item);
            const clientName = item.clients?.business_name ?? 'Unknown client';
            const data = item.content_data as Record<string, unknown>;

            return (
              <div key={item.id} className={`bg-white rounded-xl border ${item.status === 'pending' ? 'border-amber-200' : 'border-gray-200'} overflow-hidden`}>
                {/* Header row */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggle(item.id)}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {ACTION_ICONS[item.action_type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{clientName}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{ACTION_LABELS[item.action_type]}</span>
                      {typeof data.target_suburb === 'string' && (
                        <span className="text-xs text-gray-400 italic">— {data.target_suburb}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{preview}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {item.status}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(item.created_at), 'd MMM HH:mm')}
                      </span>
                      {item.edited_content && (
                        <span className="text-xs text-blue-500 italic">edited</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-gray-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* Content preview / edit */}
                    {editText !== undefined ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono leading-relaxed resize-y min-h-[160px] focus:outline-none focus:border-[#E8622A]"
                          value={editText}
                          onChange={e => setEditing(prev => ({ ...prev, [item.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(item)}
                            disabled={isWorking}
                            className="text-sm bg-[#1a2744] text-white px-4 py-2 rounded-lg hover:bg-[#243460] disabled:opacity-50"
                          >
                            Save edit
                          </button>
                          <button
                            onClick={() => setEditing(prev => { const n = { ...prev }; delete n[item.id]; return n; })}
                            className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{fullText}</pre>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                      {typeof data.post_type === 'string' && <div>Post type: <strong>{data.post_type}</strong></div>}
                      {typeof data.target_suburb === 'string' && <div>Suburb: <strong>{data.target_suburb}</strong></div>}
                      {typeof data.target_service === 'string' && <div>Service: <strong>{data.target_service}</strong></div>}
                      {typeof data.to_email === 'string' && <div>To: <strong>{data.to_email}</strong></div>}
                      {typeof data.reviewer === 'string' && <div>Reviewer: <strong>{data.reviewer}</strong></div>}
                      {typeof data.rating === 'number' && <div>Rating: <strong>{'★'.repeat(data.rating)}</strong></div>}
                      {typeof data.score === 'number' && <div>SEO Score: <strong>{data.score}/100</strong></div>}
                      {typeof data.use_ghl === 'boolean' && <div>Channel: <strong>{data.use_ghl ? 'GHL' : 'Direct GBP API'}</strong></div>}
                    </div>

                    {/* Reject reason */}
                    {item.reject_reason && (
                      <p className="text-xs text-red-500 italic">Rejected: {item.reject_reason}</p>
                    )}
                    {item.publish_result && (
                      <p className="text-xs text-green-600 italic">{item.publish_result}</p>
                    )}
                    {msg[item.id] && (
                      <p className="text-xs text-blue-600 italic">{msg[item.id]}</p>
                    )}

                    {/* Action buttons */}
                    {item.status === 'pending' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => setEditing(prev => ({ ...prev, [item.id]: fullText }))}
                          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => approve(item)}
                          disabled={isWorking}
                          className="flex items-center gap-1.5 text-sm text-blue-700 border border-blue-200 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => reject(item)}
                          disabled={isWorking}
                          className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          onClick={() => approveAndPublish(item)}
                          disabled={isWorking}
                          className="flex items-center gap-1.5 text-sm text-white bg-[#E8622A] px-4 py-2 rounded-lg hover:bg-[#d05520] disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" /> {isWorking ? 'Publishing…' : 'Approve & Publish'}
                        </button>
                      </div>
                    )}
                    {item.status === 'approved' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => publish(item)}
                          disabled={isWorking}
                          className="flex items-center gap-1.5 text-sm text-white bg-[#E8622A] px-4 py-2 rounded-lg hover:bg-[#d05520] disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" /> {isWorking ? 'Publishing…' : 'Publish now'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk actions per client */}
      {filterStatus === 'pending' && clients.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Bulk actions</p>
          <div className="flex flex-wrap gap-2">
            {clients.map(c => {
              const count = filtered.filter(i => i.client_id === c.id && i.status === 'pending').length;
              if (!count) return null;
              return (
                <button
                  key={c.id}
                  onClick={() => bulkApproveClient(c.id)}
                  className="text-xs text-blue-700 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                >
                  Approve all from {c.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

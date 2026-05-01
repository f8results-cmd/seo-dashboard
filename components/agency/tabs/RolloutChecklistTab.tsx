'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, CheckSquare, Square, Zap, StickyNote, Inbox } from 'lucide-react';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

interface RolloutItem {
  id: string;
  item_key: string;
  label: string;
  category: string;
  sort_order: number;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
  is_auto?: boolean | null;  // added by migration 019; falls back to item_key prefix detection
}

function isAutoItem(item: RolloutItem): boolean {
  return item.is_auto === true || item.item_key?.startsWith('auto_');
}

interface RolloutWeek {
  id: string;
  week_number: number;
  week_label: string;
  phase: string;
  starts_on: string;
  ends_on: string;
  completed: boolean;
  items: RolloutItem[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Setup:      'bg-sky-100 text-sky-700',
  Pipeline:   'bg-slate-100 text-slate-600',
  GBP:        'bg-blue-100 text-blue-700',
  GHL:        'bg-violet-100 text-violet-700',
  Citations:  'bg-orange-100 text-orange-700',
  Website:    'bg-indigo-100 text-indigo-700',
  'AI Editor':'bg-pink-100 text-pink-700',
  Reviews:    'bg-yellow-100 text-yellow-800',
  Backlinks:  'bg-green-100 text-green-700',
  Measurement:'bg-teal-100 text-teal-700',
  Client:     'bg-rose-100 text-rose-700',
  SEO:        'bg-cyan-100 text-cyan-700',
};

// Fixed category display order within a week
const CATEGORY_ORDER = [
  'Setup', 'Pipeline', 'GBP', 'GHL', 'Client', 'Citations', 'Website', 'AI Editor',
  'Reviews', 'Backlinks', 'Measurement', 'SEO',
];

function weekUrgency(week: RolloutWeek): 'overdue' | 'due-soon' | 'ok' | 'complete' {
  if (week.items.length > 0 && week.items.every(i => i.completed)) return 'complete';
  const today = startOfDay(new Date());
  const end = parseISO(week.ends_on);
  const daysLeft = differenceInDays(end, today);
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 2) return 'due-soon';
  return 'ok';
}

const URGENCY_WEEK_HEADER: Record<string, string> = {
  overdue:  'bg-red-50 border-red-200',
  'due-soon': 'bg-amber-50 border-amber-100',
  ok:       'bg-gray-50',
  complete: 'bg-green-50',
};

const URGENCY_BADGE: Record<string, string> = {
  overdue:    'bg-red-100 text-red-700',
  'due-soon': 'bg-amber-100 text-amber-700',
  ok:         'bg-orange-50 text-orange-600',
  complete:   'bg-green-100 text-green-700',
};

function sortedCategories(items: RolloutItem[]): string[] {
  const presentArr = items.map(i => i.category || 'Other');
  const present = new Set(presentArr);
  return CATEGORY_ORDER.filter(c => present.has(c)).concat(
    presentArr.filter((c, idx, arr) => !CATEGORY_ORDER.includes(c) && arr.indexOf(c) === idx)
  );
}

export default function RolloutChecklistTab({ client }: { client: Client }) {
  const [weeks, setWeeks] = useState<RolloutWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialising, setInitialising] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [weekDraftMsg, setWeekDraftMsg] = useState<string | null>(null);

  const supabase = createClient();

  const fetchRollout = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/rollout`);
      const data = await res.json();
      setWeeks(data.weeks ?? []);
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => { fetchRollout(); }, [fetchRollout]);

  async function initRollout(force = false) {
    setInitialising(true);
    try {
      const url = force
        ? `/api/clients/${client.id}/rollout?force=true`
        : `/api/clients/${client.id}/rollout`;
      await fetch(url, { method: 'POST' });
      await fetchRollout();
    } finally {
      setInitialising(false);
    }
  }

  async function toggleItem(item: RolloutItem) {
    const newCompleted = !item.completed;
    // Optimistic update
    const updatedWeeks = weeks.map(w => ({
      ...w,
      items: w.items.map(i => i.id === item.id
        ? { ...i, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
        : i),
    }));
    setWeeks(updatedWeeks);
    setSavingItem(item.id);
    try {
      const res = await fetch(`/api/clients/${client.id}/rollout/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      });
      const data = await res.json();
      if (data.item) {
        setWeeks(prev => prev.map(w => ({
          ...w,
          items: w.items.map(i => i.id === item.id ? { ...i, ...data.item } : i),
        })));
      }

      // Auto-draft friday_update if this completion finishes the week
      if (newCompleted && client.email) {
        const parentWeek = updatedWeeks.find(w => w.items.some(i => i.id === item.id));
        if (parentWeek && parentWeek.items.every(i => i.completed)) {
          const completedLabels = parentWeek.items.map(i => i.label);
          const body = `Hi ${client.owner_name ?? client.business_name},\n\nGreat news — ${parentWeek.week_label} is now 100% complete!\n\nHere's what was accomplished:\n${completedLabels.map(l => `• ${l}`).join('\n')}\n\nWe'll be in touch with your next update.\n\nBest regards,\nFigure 8 Results`;
          await supabase.from('approval_queue').insert({
            client_id:   client.id,
            action_type: 'friday_update',
            content_data: {
              subject:       `${parentWeek.week_label} Complete — SEO Update`,
              body,
              to_email:      client.email,
              business_name: client.business_name,
              week_number:   parentWeek.week_number,
              week_label:    parentWeek.week_label,
              progress_pct:  100,
              auto_drafted:  true,
            },
            status: 'pending',
          });
          setWeekDraftMsg(`${parentWeek.week_label} is complete — a client update email has been queued for your approval.`);
        }
      }
    } finally {
      setSavingItem(null);
    }
  }

  async function saveNotes(item: RolloutItem) {
    await fetch(`/api/clients/${client.id}/rollout/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesDraft }),
    });
    setWeeks(prev => prev.map(w => ({
      ...w,
      items: w.items.map(i => i.id === item.id ? { ...i, notes: notesDraft } : i),
    })));
    setEditingNotes(null);
  }

  function toggleWeek(weekNumber: number) {
    setExpandedWeeks(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(weekNumber)) next.delete(weekNumber);
      else next.add(weekNumber);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden animate-pulse">
            <div className="px-5 py-4 bg-gray-50 flex items-center justify-between">
              <div className="h-4 bg-gray-200 rounded w-48" />
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="p-10 text-center">
        <div className="text-3xl mb-3">📋</div>
        <p className="text-gray-700 font-medium mb-1">No rollout checklist yet</p>
        <p className="text-gray-400 text-sm mb-5">
          Seed the 40+ task checklist for {client.business_name ?? 'this client'}.
        </p>
        <button
          onClick={() => initRollout(false)}
          disabled={initialising}
          className="px-5 py-2.5 bg-[#E8622A] text-white rounded-lg text-sm font-medium hover:bg-[#d4561f] transition-colors disabled:opacity-50"
        >
          {initialising ? 'Initialising…' : 'Initialise Rollout'}
        </button>
      </div>
    );
  }

  const totalDone  = weeks.reduce((a, w) => a + w.items.filter(i => i.completed).length, 0);
  const totalItems = weeks.reduce((a, w) => a + w.items.length, 0);

  return (
    <div className="p-6 space-y-4">

      {/* Overall progress bar */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mb-3">
          {weeks.map(w => {
            const done  = w.items.filter(i => i.completed).length;
            const total = w.items.length;
            return (
              <span key={w.week_number} className="text-gray-600">
                <span className="font-semibold">Week {w.week_number}:</span>{' '}
                <span className={done === total && total > 0 ? 'text-green-600 font-medium' : 'text-gray-800'}>
                  {done}/{total}
                </span>
              </span>
            );
          })}
          <span className="ml-auto text-gray-400 font-medium">{totalDone}/{totalItems} total</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#E8622A] rounded-full transition-all"
            style={{ width: totalItems > 0 ? `${Math.round((totalDone / totalItems) * 100)}%` : '0%' }}
          />
        </div>
      </div>

      {/* Week completion auto-draft notification */}
      {weekDraftMsg && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Inbox className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="flex-1">{weekDraftMsg} <a href="/agency/approvals" className="underline font-medium">Review in Approvals →</a></span>
          <button onClick={() => setWeekDraftMsg(null)} className="text-amber-500 hover:text-amber-700">×</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showIncompleteOnly}
            onChange={e => setShowIncompleteOnly(e.target.checked)}
            className="rounded border-gray-300 text-[#E8622A] focus:ring-[#E8622A]"
          />
          Show incomplete only
        </label>
        <button
          onClick={() => initRollout(true)}
          disabled={initialising}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 disabled:opacity-50"
        >
          {initialising ? 'Re-initialising…' : 'Re-initialise rollout'}
        </button>
      </div>

      {/* Week accordions */}
      {weeks.map(week => {
        const isExpanded = expandedWeeks.has(week.week_number);
        const allItems   = week.items;
        const done       = allItems.filter(i => i.completed).length;
        const total      = allItems.length;
        const pct        = total > 0 ? Math.round((done / total) * 100) : 0;
        const visibleItems = showIncompleteOnly ? allItems.filter(i => !i.completed) : allItems;
        const categories = sortedCategories(visibleItems);
        const urgency = weekUrgency(week);
        const barColor = urgency === 'overdue' ? '#dc2626'
          : urgency === 'due-soon' ? '#f59e0b'
          : urgency === 'complete' ? '#16a34a'
          : '#E8622A';

        return (
          <div key={week.id} className={`border rounded-xl overflow-hidden ${
            urgency === 'overdue' ? 'border-red-200' :
            urgency === 'due-soon' ? 'border-amber-200' :
            urgency === 'complete' ? 'border-green-200' :
            'border-gray-200'
          }`}>

            {/* Week header */}
            <button
              onClick={() => toggleWeek(week.week_number)}
              className={`w-full flex items-center gap-3 px-5 py-4 transition-colors text-left hover:brightness-95 ${URGENCY_WEEK_HEADER[urgency]}`}
            >
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              }
              <span className="font-semibold text-gray-900 text-sm flex-1">{week.week_label}</span>
              {urgency === 'overdue' && (
                <span className="text-xs text-red-600 font-medium flex-shrink-0">Overdue</span>
              )}
              {urgency === 'due-soon' && (
                <span className="text-xs text-amber-600 font-medium flex-shrink-0">Due soon</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${URGENCY_BADGE[urgency]}`}>
                {done}/{total}
              </span>
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
              </div>
            </button>

            {isExpanded && (
              <div>
                {categories.length === 0 && (
                  <div className="px-5 py-6 text-sm text-gray-400 text-center">
                    All tasks complete ✓
                  </div>
                )}

                {categories.map(cat => {
                  const catItems = visibleItems
                    .filter(i => (i.category || 'Other') === cat)
                    .sort((a, b) => a.sort_order - b.sort_order);

                  if (catItems.length === 0) return null;

                  return (
                    <div key={cat} className="border-t border-gray-100 first:border-t-0">
                      {/* Category label */}
                      <div className="px-5 py-2 bg-gray-50/60 flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${CATEGORY_COLORS[cat] ?? 'bg-gray-100 text-gray-600'}`}>
                          {cat}
                        </span>
                      </div>

                      {/* Items */}
                      {catItems.map(item => (
                        <div
                          key={item.id}
                          className={`px-5 py-3 border-t border-gray-50 ${item.completed ? 'bg-gray-50/40' : 'bg-white'}`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleItem(item)}
                              disabled={savingItem === item.id}
                              className={`mt-0.5 flex-shrink-0 transition-opacity cursor-pointer hover:opacity-70 ${
                                savingItem === item.id ? 'opacity-40' : ''
                              }`}
                            >
                              {item.completed
                                ? <CheckSquare className="w-4 h-4 text-green-500" />
                                : <Square className="w-4 h-4 text-gray-300" />
                              }
                            </button>

                            <div className="flex-1 min-w-0">
                              {/* Label row */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm leading-snug ${
                                  item.completed ? 'line-through text-gray-400' : 'text-gray-800'
                                }`}>
                                  {item.label}
                                </span>
                                {isAutoItem(item) && (
                                  <span className="inline-flex items-center gap-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded font-medium">
                                    <Zap className="w-3 h-3" /> auto
                                  </span>
                                )}
                              </div>

                              {/* Completed timestamp */}
                              {item.completed && item.completed_at && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Completed {new Date(item.completed_at).toLocaleDateString('en-AU', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                  })}
                                </p>
                              )}

                              {/* Notes */}
                              {editingNotes === item.id ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={notesDraft}
                                    onChange={e => setNotesDraft(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveNotes(item);
                                      if (e.key === 'Escape') setEditingNotes(null);
                                    }}
                                    placeholder="Add a note…"
                                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#E8622A]"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => saveNotes(item)}
                                    className="text-xs text-[#E8622A] font-medium hover:opacity-80"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingNotes(null)}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditingNotes(item.id); setNotesDraft(item.notes ?? ''); }}
                                  className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  <StickyNote className="w-3 h-3" />
                                  {item.notes ? (
                                    <span className="italic text-gray-500">{item.notes}</span>
                                  ) : (
                                    'Add note'
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

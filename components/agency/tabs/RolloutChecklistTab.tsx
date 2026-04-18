'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Loader2, ChevronDown, ChevronRight, Mail, AlertCircle, RefreshCw } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import type { Client, RolloutWeek, RolloutItem } from '@/lib/types';

const PHASE_BADGE: Record<string, string> = {
  gbp_setup:      'bg-blue-50 text-blue-700',
  website:        'bg-purple-50 text-purple-700',
  website_onpage: 'bg-violet-50 text-violet-700',
  citations:      'bg-orange-50 text-orange-700',
  ongoing:        'bg-green-50 text-green-700',
};

const CATEGORY_DOT: Record<string, string> = {
  GBP:       'bg-blue-500',
  Website:   'bg-purple-500',
  SEO:       'bg-green-500',
  Citations: 'bg-orange-500',
  Client:    'bg-rose-500',
};

interface Props {
  client: Client;
}

export default function RolloutChecklistTab({ client }: Props) {
  const [weeks, setWeeks]         = useState<RolloutWeek[]>([]);
  const [loading, setLoading]     = useState(true);
  const [initialising, setInit]   = useState(false);
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set([1]));
  const [toggling, setToggling]   = useState<Set<string>>(new Set());
  const [error, setError]         = useState('');

  const loadWeeks = useCallback(async () => {
    setError('');
    const res = await fetch(`/api/clients/${client.id}/rollout`);
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Failed to load'); setLoading(false); return; }
    setWeeks(json.weeks ?? []);
    // Auto-open the current active (incomplete) week
    const firstIncomplete = (json.weeks ?? []).find((w: RolloutWeek) => !w.completed);
    if (firstIncomplete) {
      setOpenWeeks(new Set([firstIncomplete.week_number]));
    }
    setLoading(false);
  }, [client.id]);

  useEffect(() => { loadWeeks(); }, [loadWeeks]);

  async function initialise() {
    setInit(true);
    const res = await fetch(`/api/clients/${client.id}/rollout`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Failed to initialise'); setInit(false); return; }
    setInit(false);
    loadWeeks();
  }

  async function toggleItem(item: RolloutItem) {
    if (toggling.has(item.id)) return;
    setToggling(prev => new Set(Array.from(prev).concat(item.id)));

    const newCompleted = !item.completed;
    // Optimistic update
    setWeeks(ws => ws.map(w => ({
      ...w,
      items: w.items?.map(i => i.id === item.id
        ? { ...i, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
        : i
      ),
    })));

    const res = await fetch(`/api/clients/${client.id}/rollout/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: newCompleted }),
    });
    if (!res.ok) {
      // Revert on error
      setWeeks(ws => ws.map(w => ({
        ...w,
        items: w.items?.map(i => i.id === item.id ? { ...i, completed: item.completed, completed_at: item.completed_at } : i),
      })));
    }
    setToggling(prev => { const s = new Set(Array.from(prev)); s.delete(item.id); return s; });
  }

  function toggleWeek(wn: number) {
    setOpenWeeks(prev => {
      const s = new Set(Array.from(prev));
      if (s.has(wn)) s.delete(wn); else s.add(wn);
      return s;
    });
  }

  function weekProgress(week: RolloutWeek) {
    const items = week.items ?? [];
    if (items.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = items.filter(i => i.completed).length;
    return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
  }

  function isWeekDone(week: RolloutWeek) {
    const { done, total } = weekProgress(week);
    return total > 0 && done === total && !!week.friday_update;
  }

  function isOverdue(week: RolloutWeek) {
    return !isWeekDone(week) && isBefore(parseISO(week.ends_on), startOfDay(new Date()));
  }

  // Group items by category
  function groupByCategory(items: RolloutItem[]) {
    const groups: Record<string, RolloutItem[]> = {};
    for (const item of items) {
      const cat = item.category ?? 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading rollout…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-600 font-medium mb-2">No rollout checklist yet</p>
          <p className="text-sm text-gray-400 mb-5">
            {client.onboarding_date
              ? `Will start from ${format(parseISO(client.onboarding_date), 'd MMM yyyy')}`
              : 'Set an onboarding date first, or initialise now'}
          </p>
          <button
            onClick={initialise}
            disabled={initialising}
            className="inline-flex items-center gap-2 bg-[#E8622A] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#d05520] transition-colors disabled:opacity-50"
          >
            {initialising ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {initialising ? 'Initialising…' : 'Initialise Rollout'}
          </button>
        </div>
      </div>
    );
  }

  const totalItems = weeks.reduce((s, w) => s + (w.items?.length ?? 0), 0);
  const doneItems  = weeks.reduce((s, w) => s + (w.items?.filter(i => i.completed).length ?? 0), 0);
  const overallPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div className="p-6 space-y-4">
      {/* Overall progress */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-gray-900">4-Week Rollout Checklist</h2>
        <span className="text-sm font-medium text-gray-600">
          {doneItems} / {totalItems}&nbsp;
          <span className={overallPct === 100 ? 'text-green-600' : 'text-[#E8622A]'}>{overallPct}%</span>
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${overallPct}%`, backgroundColor: overallPct === 100 ? '#22c55e' : '#E8622A' }}
        />
      </div>

      {/* Weeks */}
      {weeks.map(week => {
        const open     = openWeeks.has(week.week_number);
        const { done, total, pct } = weekProgress(week);
        const allItemsDone = total > 0 && done === total;
        const weekDone = isWeekDone(week);
        const overdue  = isOverdue(week);
        const phaseBadge = PHASE_BADGE[week.phase] ?? 'bg-gray-100 text-gray-600';
        const groups   = groupByCategory(week.items ?? []);

        return (
          <div
            key={week.id}
            className={`border rounded-xl overflow-hidden transition-colors ${
              weekDone ? 'border-green-200' : overdue ? 'border-red-200' : 'border-gray-200'
            }`}
          >
            {/* Week header */}
            <button
              onClick={() => toggleWeek(week.week_number)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                weekDone ? 'bg-green-50' : overdue ? 'bg-red-50' : 'bg-gray-50'
              }`}
            >
              {open
                ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900">{week.week_label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${phaseBadge}`}>
                    {week.phase.replace(/_/g, ' ')}
                  </span>
                  {weekDone && (
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      Complete
                    </span>
                  )}
                  {overdue && !weekDone && (
                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Overdue
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-400">
                    {format(parseISO(week.starts_on), 'd MMM')} – {format(parseISO(week.ends_on), 'd MMM yyyy')}
                  </span>
                  <span className="text-xs text-gray-400">{done}/{total} tasks</span>
                  {week.friday_update && (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Update sent {week.friday_update.sent_at ? format(parseISO(week.friday_update.sent_at), 'd MMM') : ''}
                    </span>
                  )}
                </div>
              </div>
              {/* Mini progress bar */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: weekDone ? '#22c55e' : '#E8622A' }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
              </div>
            </button>

            {/* Week content */}
            {open && (
              <div className="divide-y divide-gray-100">
                {/* Friday update notice */}
                {allItemsDone && !week.friday_update && (
                  <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-sm text-blue-700">
                      All items done — send a Friday update to mark this week complete
                      <a
                        href={`/agency/clients/${client.id}?tab=friday`}
                        className="ml-2 font-medium underline hover:no-underline"
                      >
                        Go to Friday Update →
                      </a>
                    </span>
                  </div>
                )}

                {/* Category groups */}
                {Object.entries(groups).map(([cat, items]) => (
                  <div key={cat}>
                    <div className="px-4 py-2 bg-white border-b border-gray-50 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_DOT[cat] ?? 'bg-gray-400'}`} />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cat}</span>
                    </div>
                    {items.map(item => {
                      const isToggling = toggling.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 px-4 py-2.5 ${item.completed ? 'bg-gray-50/60' : 'bg-white'}`}
                        >
                          <button
                            onClick={() => !isToggling && toggleItem(item)}
                            disabled={isToggling}
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              item.completed
                                ? 'bg-green-500 border-green-500'
                                : 'border-gray-300 hover:border-green-400 bg-white'
                            } disabled:opacity-50`}
                            aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {isToggling
                              ? <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                              : item.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            }
                          </button>
                          <span className={`flex-1 text-sm min-w-0 ${item.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {item.label}
                          </span>
                          {item.completed && item.completed_at && (
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {format(parseISO(item.completed_at), 'd MMM')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Friday update preview if sent */}
                {week.friday_update && (
                  <div className="px-4 py-3 bg-blue-50/50 border-t border-blue-100">
                    <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      Friday Update — {week.friday_update.sent_at ? format(parseISO(week.friday_update.sent_at), 'EEEE d MMM yyyy') : 'Draft'}
                    </p>
                    <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-line">{week.friday_update.content}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

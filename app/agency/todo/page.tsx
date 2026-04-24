'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { format, parseISO, isBefore, startOfDay, isToday } from 'date-fns';
import { Check, AlertCircle, Mail, ChevronDown } from 'lucide-react';

interface RolloutItemRow {
  id: string;
  label: string;
  category: string | null;
  completed: boolean;
  completed_at: string | null;
}

interface RolloutWeekRow {
  id: string;
  client_id: string;
  week_number: number;
  week_label: string;
  phase: string;
  starts_on: string;
  ends_on: string;
  completed: boolean;
  items: RolloutItemRow[];
  friday_update: { id: string; sent_at: string | null } | null;
  client_name: string;
}

const PHASE_BADGE: Record<string, string> = {
  gbp_setup:      'bg-blue-50 text-blue-700',
  website:        'bg-purple-50 text-purple-700',
  website_onpage: 'bg-violet-50 text-violet-700',
  citations:      'bg-orange-50 text-orange-700',
  ongoing:        'bg-green-50 text-green-700',
};

function weekStatus(week: RolloutWeekRow, today: Date) {
  const done = week.items.filter(i => i.completed).length;
  const total = week.items.length;
  const allDone = total > 0 && done === total && !!week.friday_update;
  const overdue = !allDone && isBefore(parseISO(week.ends_on), today);
  const dueToday = isToday(parseISO(week.ends_on));
  return { done, total, allDone, overdue, dueToday };
}

export default function RolloutOverviewPage() {
  const [weeks, setWeeks]         = useState<RolloutWeekRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const supabase = createClient();
  const today = startOfDay(new Date());

  const load = useCallback(async () => {
    // Only load weeks ending within the last 30 days or in the future — completed
    // weeks older than 30 days are irrelevant to the operational view.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: weeksData } = await supabase
      .from('client_rollout_weeks')
      .select(`
        id, client_id, week_number, week_label, phase, starts_on, ends_on, completed,
        items:client_rollout_items(id, label, category, completed, completed_at),
        clients(business_name)
      `)
      .gte('ends_on', thirtyDaysAgoStr)
      .order('ends_on', { ascending: true })
      .order('week_number', { ascending: true });

    // Only need recent friday updates — enough to cover the weeks we loaded
    const { data: fridayData } = await supabase
      .from('friday_updates')
      .select('id, client_id, week_number, sent_at')
      .not('sent_at', 'is', null)
      .gte('sent_at', thirtyDaysAgo.toISOString())
      .order('sent_at', { ascending: false })
      .limit(500);

    // Build lookup: client_id + week_number → friday update
    const fuMap: Record<string, { id: string; sent_at: string | null }> = {};
    for (const fu of (fridayData ?? [])) {
      const key = `${fu.client_id}__${fu.week_number}`;
      if (!fuMap[key]) fuMap[key] = { id: fu.id, sent_at: fu.sent_at };
    }

    const rows: RolloutWeekRow[] = (weeksData ?? []).map((w: Record<string, unknown>) => {
      const clientInfo = w.clients as { business_name: string } | null;
      return {
        id: w.id as string,
        client_id: w.client_id as string,
        week_number: w.week_number as number,
        week_label: w.week_label as string,
        phase: w.phase as string,
        starts_on: w.starts_on as string,
        ends_on: w.ends_on as string,
        completed: w.completed as boolean,
        items: (w.items as RolloutItemRow[]) ?? [],
        friday_update: fuMap[`${w.client_id}__${w.week_number}`] ?? null,
        client_name: clientInfo?.business_name ?? 'Unknown',
      };
    });

    setWeeks(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open     = weeks.filter(w => !weekStatus(w, today).allDone);
  const complete = weeks.filter(w =>  weekStatus(w, today).allDone);

  // Group open weeks by ends_on date
  const grouped: Record<string, RolloutWeekRow[]> = {};
  for (const w of open) {
    if (!grouped[w.ends_on]) grouped[w.ends_on] = [];
    grouped[w.ends_on].push(w);
  }
  const sortedDates = Object.keys(grouped).sort();

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Rollout Checklist</h1>
        <span className="text-sm text-gray-400">{open.length} weeks in progress</span>
      </div>

      {open.length === 0 && (
        <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
          <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-gray-600 font-medium">All weeks complete!</p>
        </div>
      )}

      {sortedDates.map(date => {
        const dateWeeks = grouped[date];
        const isPast   = isBefore(parseISO(date), today);
        const isThisWeek = isToday(parseISO(date)) || (!isPast && isBefore(parseISO(date), new Date(today.getTime() + 7 * 86400000)));
        return (
          <div key={date}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className={`text-sm font-semibold ${isPast ? 'text-red-600' : isThisWeek ? 'text-[#E8622A]' : 'text-gray-700'}`}>
                Due {format(parseISO(date), 'EEEE d MMM yyyy')}
              </h2>
              {isPast && <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Overdue</span>}
              {isThisWeek && !isPast && <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">This week</span>}
            </div>
            <div className="space-y-2">
              {dateWeeks.map(week => {
                const { done, total, overdue } = weekStatus(week, today);
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const phaseBadge = PHASE_BADGE[week.phase] ?? 'bg-gray-100 text-gray-600';
                const allItemsDone = total > 0 && done === total;
                return (
                  <Link
                    key={week.id}
                    href={`/agency/clients/${week.client_id}?tab=checklist`}
                    className={`block p-4 rounded-xl border transition-colors hover:shadow-sm ${
                      overdue ? 'border-red-200 bg-red-50/30 hover:bg-red-50/60' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm text-gray-900">{week.client_name}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${phaseBadge}`}>
                            {week.week_label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          <span>{format(parseISO(week.starts_on), 'd MMM')} – {format(parseISO(week.ends_on), 'd MMM yyyy')}</span>
                          <span>{done}/{total} tasks</span>
                          {week.friday_update && (
                            <span className="text-blue-600 flex items-center gap-1">
                              <Mail className="w-3 h-3" /> Update sent
                            </span>
                          )}
                          {allItemsDone && !week.friday_update && (
                            <span className="text-amber-600 flex items-center gap-1">
                              <Mail className="w-3 h-3" /> Needs Friday update
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                        <div className="w-20 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: overdue ? '#ef4444' : '#E8622A' }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Completed weeks */}
      {complete.length > 0 && (
        <div>
          <button
            onClick={() => setShowComplete(s => !s)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showComplete ? '' : '-rotate-90'}`} />
            Completed weeks ({complete.length})
          </button>
          {showComplete && (
            <div className="space-y-2">
              {complete.map(week => (
                <Link
                  key={week.id}
                  href={`/agency/clients/${week.client_id}?tab=checklist`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-green-100 bg-green-50/30 hover:bg-green-50/60 transition-colors opacity-70"
                >
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 font-medium">{week.client_name}</span>
                  <span className="text-xs text-gray-400">— {week.week_label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{format(parseISO(week.ends_on), 'd MMM yyyy')}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

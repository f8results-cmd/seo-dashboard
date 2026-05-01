'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Send, CheckCircle, Clock, X, Plus, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import type { Client, FridayUpdate } from '@/lib/types';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

interface WeekOption {
  week_number: number;
  week_label: string;
  ends_on: string;
}

interface WeekContext {
  rolloutItemsDone: string[];
  postsPublished: number;
  reviewsResponded: number;
}

export default function FridayUpdateTab({ client }: { client: Client }) {
  const [notes,       setNotes]      = useState('');
  const [progressPct, setProgressPct] = useState(50);
  const [generating,  setGenerating] = useState(false);
  const [saving,      setSaving]     = useState(false);
  const [queuing,     setQueuing]    = useState(false);
  const [saved,       setSaved]      = useState(false);
  const [queued,      setQueued]     = useState(false);
  const [history,     setHistory]    = useState<FridayUpdate[]>([]);
  const [modalUpdate, setModalUpdate] = useState<FridayUpdate | null>(null);
  const [msg,         setMsg]        = useState('');
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [weekNumber,  setWeekNumber] = useState<number | ''>('');
  const [userId,      setUserId]     = useState<string | null>(null);
  const [weekContext, setWeekContext] = useState<WeekContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const [{ data: histData }, { data: weeksData }, { data: { user } }] = await Promise.all([
      supabase.from('friday_updates').select('*').eq('client_id', client.id).order('sent_at', { ascending: false }),
      supabase.from('client_rollout_weeks').select('week_number, week_label, ends_on').eq('client_id', client.id).order('week_number'),
      supabase.auth.getUser(),
    ]);
    setHistory((histData ?? []) as FridayUpdate[]);
    setWeekOptions((weeksData ?? []) as WeekOption[]);
    setUserId(user?.id ?? null);

    if (weeksData && weeksData.length > 0 && !weekNumber) {
      const today = new Date().toISOString().split('T')[0];
      const current = (weeksData as WeekOption[]).find(w => w.ends_on >= today);
      if (current) setWeekNumber(current.week_number);
    }
  }, [client.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load this-week context from DB when week changes
  useEffect(() => {
    if (!weekNumber) return;
    const week = weekOptions.find(w => w.week_number === weekNumber);
    if (!week) return;

    setLoadingContext(true);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
    const weekEnd   = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

    Promise.all([
      supabase
        .from('client_rollout_items')
        .select('label')
        .eq('client_id', client.id)
        .eq('completed', true)
        .gte('completed_at', weekStart)
        .lte('completed_at', weekEnd),
      supabase
        .from('gbp_posts')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .eq('status', 'posted')
        .gte('scheduled_date', weekStart)
        .lte('scheduled_date', weekEnd),
      supabase
        .from('review_responses')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd),
    ]).then(([itemsRes, postsRes, reviewsRes]) => {
      setWeekContext({
        rolloutItemsDone: (itemsRes.data ?? []).map((i: { label: string }) => i.label),
        postsPublished: postsRes.count ?? 0,
        reviewsResponded: reviewsRes.count ?? 0,
      });
      setLoadingContext(false);
    });
  }, [weekNumber, client.id, weekOptions]);

  const lastSent = history.find(u => u.sent_at) ?? null;

  function autoFillFromContext() {
    if (!weekContext) return;
    const bullets: string[] = [];
    if (weekContext.rolloutItemsDone.length > 0) {
      bullets.push('Rollout tasks completed this week:');
      weekContext.rolloutItemsDone.forEach(l => bullets.push(`  • ${l}`));
    }
    if (weekContext.postsPublished > 0)
      bullets.push(`• ${weekContext.postsPublished} GBP post${weekContext.postsPublished > 1 ? 's' : ''} published`);
    if (weekContext.reviewsResponded > 0)
      bullets.push(`• ${weekContext.reviewsResponded} Google review response${weekContext.reviewsResponded > 1 ? 's' : ''} drafted`);
    if (bullets.length === 0) bullets.push('• No automated activity found this week — add manual notes.');
    setNotes(bullets.join('\n'));
  }

  async function generateDraft() {
    if (!RAILWAY_URL) { setMsg('RAILWAY_URL not configured — write the update manually.'); return; }
    setGenerating(true);
    setSaved(false);
    setQueued(false);
    setMsg('');
    try {
      const res = await fetch(`${RAILWAY_URL}/friday-update/${client.id}`, { method: 'POST' });
      const json = await res.json();
      if (json.draft) {
        setNotes(json.draft);
      } else {
        setMsg('Could not generate draft — check Railway connection.');
      }
    } catch {
      setMsg('Error connecting to backend. Check RAILWAY_URL.');
    }
    setGenerating(false);
  }

  async function logUpdate() {
    setSaving(true);
    setMsg('');
    const { error } = await supabase.from('friday_updates').insert({
      client_id:       client.id,
      content:         notes.trim() || '—',
      sent_at:         new Date().toISOString(),
      delivery_method: 'manual',
      week_number:     weekNumber || null,
      sent_by_user_id: userId,
    });
    if (error) {
      setMsg(`Failed to save: ${error.message}`);
    } else {
      setSaved(true);
      setNotes('');
      loadData();
    }
    setSaving(false);
  }

  async function saveAndQueue() {
    if (!client.email) { setMsg('No client email address set — add it in the client edit form.'); return; }
    setQueuing(true);
    setMsg('');

    const selectedWeek = weekOptions.find(w => w.week_number === weekNumber);
    const weekLabel = selectedWeek?.week_label ?? `Week ${weekNumber}`;
    const subject = `Your SEO Update — ${weekLabel}`;

    const body = notes.trim()
      ? `Hi ${client.owner_name ?? client.business_name},\n\nHere's your SEO update for ${weekLabel}:\n\n${notes.trim()}\n\nProgress this week: ${progressPct}%\n\nBest regards,\nFigure 8 Results`
      : `Hi ${client.owner_name ?? client.business_name},\n\nHere's your SEO update for ${weekLabel}.\n\nProgress this week: ${progressPct}%\n\nBest regards,\nFigure 8 Results`;

    const { error } = await supabase.from('approval_queue').insert({
      client_id:   client.id,
      action_type: 'friday_update',
      content_data: {
        subject,
        body,
        to_email:      client.email,
        business_name: client.business_name,
        week_number:   weekNumber || null,
        week_label:    weekLabel,
        progress_pct:  progressPct,
        notes:         notes.trim(),
      },
      status: 'pending',
    });

    if (error) {
      setMsg(`Failed to queue: ${error.message}`);
    } else {
      setQueued(true);
      setNotes('');
      setProgressPct(50);
    }
    setQueuing(false);
  }

  return (
    <div className="p-6 space-y-6">

      {/* Last sent status */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock className="w-4 h-4 flex-shrink-0" />
        {lastSent
          ? <>Last update sent: <span className="font-medium text-gray-700">{format(parseISO(lastSent.sent_at!), 'd MMM yyyy')}</span></>
          : 'No updates logged yet.'}
      </div>

      {/* Success banners */}
      {saved && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            Friday update logged successfully.
          </div>
          <button onClick={() => setSaved(false)} className="text-green-600 hover:text-green-800 font-medium">
            Log another
          </button>
        </div>
      )}
      {queued && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-amber-500 shrink-0" />
            Queued for approval — review it in the <a href="/agency/approvals" className="underline font-medium">Approvals</a> page before sending.
          </div>
          <button onClick={() => setQueued(false)} className="text-amber-700 hover:text-amber-900 font-medium">
            Write another
          </button>
        </div>
      )}

      {/* Log form */}
      {!saved && !queued && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
          <p className="text-sm font-medium text-gray-700">Prepare Friday update</p>

          {/* Week selector */}
          {weekOptions.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 whitespace-nowrap">Rollout week:</label>
              <select
                value={weekNumber}
                onChange={e => setWeekNumber(e.target.value ? Number(e.target.value) : '')}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 bg-white"
              >
                <option value="">Not linked to a week</option>
                {weekOptions.map(w => (
                  <option key={w.week_number} value={w.week_number}>
                    {w.week_label} (due {format(parseISO(w.ends_on), 'd MMM')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Progress slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <label className="text-gray-600">Week progress</label>
              <span className="font-semibold text-[#E8622A]">{progressPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progressPct}
              onChange={e => setProgressPct(Number(e.target.value))}
              className="w-full accent-[#E8622A]"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Just started</span>
              <span>Halfway</span>
              <span>Complete</span>
            </div>
          </div>

          {/* This-week context chips */}
          {weekContext && !loadingContext && (
            <div className="flex flex-wrap gap-2 items-center">
              {weekContext.rolloutItemsDone.length > 0 && (
                <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full">
                  ✓ {weekContext.rolloutItemsDone.length} task{weekContext.rolloutItemsDone.length > 1 ? 's' : ''} done
                </span>
              )}
              {weekContext.postsPublished > 0 && (
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full">
                  📝 {weekContext.postsPublished} post{weekContext.postsPublished > 1 ? 's' : ''} published
                </span>
              )}
              {weekContext.reviewsResponded > 0 && (
                <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-full">
                  💬 {weekContext.reviewsResponded} review{weekContext.reviewsResponded > 1 ? 's' : ''} responded
                </span>
              )}
              <button
                onClick={autoFillFromContext}
                className="text-xs text-[#E8622A] hover:text-[#d05520] underline underline-offset-2"
              >
                Auto-fill from activity
              </button>
            </div>
          )}

          {/* Notes textarea */}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={6}
            placeholder="Bullet-point notes for the client update email…"
            className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 bg-white resize-y"
          />

          {msg && <p className="text-sm text-red-600">{msg}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary: queue for approval (sends to client after operator approves) */}
            <button
              onClick={saveAndQueue}
              disabled={queuing}
              className="flex items-center gap-2 bg-[#E8622A] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#d05520] transition-colors disabled:opacity-40"
            >
              <Inbox className="w-4 h-4" />
              {queuing ? 'Queueing…' : 'Save and Queue for Approval'}
            </button>

            <button
              onClick={generateDraft}
              disabled={generating}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? 'Generating…' : 'AI Draft'}
            </button>

            {/* Secondary: just log it (already sent outside app) */}
            <button
              onClick={logUpdate}
              disabled={saving}
              className="flex items-center gap-2 border border-gray-200 text-gray-500 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Saving…' : 'Already Sent — Log Only'}
            </button>
          </div>

          {!client.email && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              No client email set. "Queue" will be disabled until you add one in <a href={`/agency/clients/${client.id}/edit`} className="underline">Edit Client</a>.
            </p>
          )}
        </div>
      )}

      {/* History */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-gray-400" />
          Update history
          <span className="text-xs font-normal text-gray-400 ml-1">{history.length} total</span>
        </h3>

        {history.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No updates logged yet. Log your first one above.</p>
        ) : (
          <div className="space-y-2">
            {history.map(u => (
              <button
                key={u.id}
                onClick={() => setModalUpdate(u)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-800">
                    {format(parseISO(u.sent_at!), 'd MMM yyyy')}
                  </span>
                  {u.week_number && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Week {u.week_number}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 truncate max-w-xs group-hover:text-gray-600">
                  {u.content === '—' ? 'No notes' : u.content.slice(0, 60) + (u.content.length > 60 ? '…' : '')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History modal */}
      {modalUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">{format(parseISO(modalUpdate.sent_at!), 'd MMM yyyy')}</p>
                {modalUpdate.week_number && (
                  <span className="text-xs text-blue-600">Week {modalUpdate.week_number}</span>
                )}
              </div>
              <button onClick={() => setModalUpdate(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {modalUpdate.content === '—'
                ? <p className="text-sm text-gray-400 italic">No notes recorded for this update.</p>
                : <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{modalUpdate.content}</pre>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

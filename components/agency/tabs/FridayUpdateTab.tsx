'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Sparkles, Inbox, Send, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import type { Client, FridayUpdate } from '@/lib/types';

interface WeekOption {
  week_number: number;
  week_label: string;
  ends_on: string;
}

interface WeekContext {
  rolloutItemsDone: string[];
  postsPublished: number;
  reviewsResponded: number;
  citationsSubmitted: number;
}

// ── Dynamic bullet list ───────────────────────────────────────────────────────

function BulletList({
  bullets,
  onChange,
  placeholder,
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  placeholder: string;
}) {
  function update(i: number, val: string) {
    const next = [...bullets];
    next[i] = val;
    onChange(next);
  }
  function add() { onChange([...bullets, '']); }
  function remove(i: number) { onChange(bullets.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-1.5">
      {bullets.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-gray-400 text-sm select-none shrink-0">•</span>
          <input
            type="text"
            value={b}
            onChange={e => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-gray-300 hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#E8622A] transition-colors mt-1"
      >
        <Plus className="w-3.5 h-3.5" /> Add bullet
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FridayUpdateTab({ client }: { client: Client }) {
  const supabase = createClient();

  // Form state
  const firstName = (client.owner_name ?? '').split(' ')[0] || 'there';
  const [thisWeek,      setThisWeek]      = useState<string[]>(['']);
  const [nextWeek,      setNextWeek]      = useState<string[]>(['']);
  const [notes,         setNotes]         = useState('');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [progressPct,   setProgressPct]   = useState(50);
  const [weekNumber,    setWeekNumber]    = useState<number | ''>('');

  // UI state
  const [weekOptions,     setWeekOptions]     = useState<WeekOption[]>([]);
  const [weekContext,     setWeekContext]      = useState<WeekContext | null>(null);
  const [loadingContext,  setLoadingContext]   = useState(false);
  const [history,         setHistory]         = useState<FridayUpdate[]>([]);
  const [userId,          setUserId]          = useState<string | null>(null);
  const [saving,          setSaving]          = useState(false);
  const [queuing,         setQueuing]         = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [queued,          setQueued]          = useState(false);
  const [msg,             setMsg]             = useState('');
  const [showHistory,     setShowHistory]     = useState(false);
  const [modalUpdate,     setModalUpdate]     = useState<FridayUpdate | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: histData }, { data: weeksData }, { data: { user } }] = await Promise.all([
      supabase.from('friday_updates').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(20),
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

  // Load week context when week changes
  useEffect(() => {
    if (!weekNumber) return;
    setLoadingContext(true);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
    const weekEnd   = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

    Promise.all([
      supabase.from('client_rollout_items').select('label').eq('client_id', client.id)
        .eq('completed', true).gte('completed_at', weekStart).lte('completed_at', weekEnd),
      supabase.from('gbp_posts').select('id', { count: 'exact', head: true })
        .eq('client_id', client.id).eq('status', 'posted').gte('scheduled_date', weekStart).lte('scheduled_date', weekEnd),
      supabase.from('review_responses').select('id', { count: 'exact', head: true })
        .eq('client_id', client.id).gte('created_at', weekStart).lte('created_at', weekEnd),
    ]).then(([itemsRes, postsRes, reviewsRes]) => {
      setWeekContext({
        rolloutItemsDone: (itemsRes.data ?? []).map((i: { label: string }) => i.label),
        postsPublished: postsRes.count ?? 0,
        reviewsResponded: reviewsRes.count ?? 0,
        citationsSubmitted: 0,
      });
      setLoadingContext(false);
    });
  }, [weekNumber, client.id]);

  function autoSuggest() {
    if (!weekContext) return;
    const bullets: string[] = [];
    weekContext.rolloutItemsDone.forEach(l => bullets.push(l));
    if (weekContext.postsPublished > 0)
      bullets.push(`${weekContext.postsPublished} GBP post${weekContext.postsPublished > 1 ? 's' : ''} published to Google`);
    if (weekContext.reviewsResponded > 0)
      bullets.push(`${weekContext.reviewsResponded} Google review response${weekContext.reviewsResponded > 1 ? 's' : ''} drafted`);
    if (bullets.length === 0) bullets.push('No automated activity found this week');
    setThisWeek(bullets);
  }

  // Build the email body from structured fields
  function buildEmailBody(): string {
    const thisWeekLines = thisWeek.filter(b => b.trim()).map(b => `- ${b.trim()}`).join('\n');
    const nextWeekLines = nextWeek.filter(b => b.trim()).map(b => `- ${b.trim()}`).join('\n');
    const notesSection = notes.trim() ? `NOTES:\n${notes.trim()}\n\n` : '';

    return `Hey ${firstName},

I hope you've had a good week. Sending over an update for the SEO now.

THIS WEEK:
${thisWeekLines || '- Nothing logged yet'}

NEXT WEEK:
${nextWeekLines || '- To be confirmed'}

${notesSection}Cheers,
Seb
Figure 8 Results`;
  }

  function buildSubject(): string {
    const selectedWeek = weekOptions.find(w => w.week_number === weekNumber);
    const weekLabel = selectedWeek?.week_label ?? `Week ${weekNumber}`;
    return `Weekly SEO Update - ${client.business_name} - ${weekLabel}`;
  }

  function resetForm() {
    setThisWeek(['']);
    setNextWeek(['']);
    setNotes('');
    setOperatorNotes('');
    setProgressPct(50);
    setMsg('');
  }

  async function saveAndQueue() {
    if (!client.email) { setMsg('No client email set — add one in Edit Client.'); return; }
    setQueuing(true);
    setMsg('');

    const body = buildEmailBody();
    const subject = buildSubject();

    const { error } = await supabase.from('approval_queue').insert({
      client_id:    client.id,
      action_type:  'friday_update',
      content_data: {
        subject,
        body,
        to_email:       client.email,
        business_name:  client.business_name,
        week_number:    weekNumber || null,
        progress_pct:   progressPct,
        this_week:      thisWeek.filter(b => b.trim()),
        next_week:      nextWeek.filter(b => b.trim()),
        notes:          notes.trim(),
        operator_notes: operatorNotes.trim(),
        first_name:     firstName,
      },
      status: 'pending',
    });

    if (error) {
      setMsg(`Failed to queue: ${error.message}`);
    } else {
      setQueued(true);
      resetForm();
      loadData();
    }
    setQueuing(false);
  }

  async function saveWithoutQueuing() {
    setSaving(true);
    setMsg('');
    const body = buildEmailBody();

    const { error } = await supabase.from('friday_updates').insert({
      client_id:       client.id,
      content:         body,
      sent_at:         null,
      delivery_method: 'draft',
      week_number:     weekNumber || null,
      sent_by_user_id: userId,
    });

    if (error) {
      setMsg(`Failed to save: ${error.message}`);
    } else {
      setSaved(true);
      resetForm();
      loadData();
    }
    setSaving(false);
  }

  const lastSent = history.find(u => u.sent_at) ?? null;

  return (
    <div className="p-6 space-y-5">

      {/* Last sent */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock className="w-4 h-4 shrink-0" />
        {lastSent
          ? <>Last update sent: <span className="font-medium text-gray-700">{format(parseISO(lastSent.sent_at!), 'd MMM yyyy')}</span></>
          : 'No updates sent yet.'}
      </div>

      {/* Success banners */}
      {saved && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Update saved as draft.</div>
          <button onClick={() => setSaved(false)} className="font-medium hover:text-green-900">New update</button>
        </div>
      )}
      {queued && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Queued — review in <a href="/agency/approvals" className="underline font-medium ml-1">Approvals</a> before sending.
          </div>
          <button onClick={() => setQueued(false)} className="font-medium hover:text-amber-900">Write another</button>
        </div>
      )}

      {/* Form */}
      {!saved && !queued && (
        <div className="space-y-5">

          {/* Week selector + progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {weekOptions.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rollout week</label>
                <select
                  value={weekNumber}
                  onChange={e => setWeekNumber(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 bg-white"
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
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label className="text-gray-500">Week progress</label>
                <span className="font-semibold text-[#E8622A]">{progressPct}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={progressPct}
                onChange={e => setProgressPct(Number(e.target.value))}
                className="w-full accent-[#E8622A]"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>Just started</span><span>Halfway</span><span>Complete</span>
              </div>
            </div>
          </div>

          {/* Email preview header */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 space-y-0.5">
            <p><span className="font-semibold text-gray-800">To:</span> {client.email ?? <span className="text-amber-600">not set</span>}</p>
            <p><span className="font-semibold text-gray-800">Subject:</span> {buildSubject()}</p>
            <p className="text-gray-400 pt-1 text-xs">Hey {firstName}, I hope you've had a good week. Sending over an update for the SEO now.</p>
          </div>

          {/* This Week */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-800">THIS WEEK:</label>
              <button
                type="button"
                onClick={autoSuggest}
                disabled={!weekContext || loadingContext}
                className="flex items-center gap-1 text-xs text-[#E8622A] hover:text-[#d05520] disabled:opacity-40 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {loadingContext ? 'Loading…' : 'Auto-suggest from activity'}
              </button>
            </div>
            {weekContext && !loadingContext && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {weekContext.rolloutItemsDone.length > 0 && (
                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                    {weekContext.rolloutItemsDone.length} task{weekContext.rolloutItemsDone.length > 1 ? 's' : ''} completed
                  </span>
                )}
                {weekContext.postsPublished > 0 && (
                  <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                    {weekContext.postsPublished} GBP post{weekContext.postsPublished > 1 ? 's' : ''} published
                  </span>
                )}
                {weekContext.reviewsResponded > 0 && (
                  <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                    {weekContext.reviewsResponded} review response{weekContext.reviewsResponded > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
            <BulletList
              bullets={thisWeek}
              onChange={setThisWeek}
              placeholder="What was completed or progressed this week…"
            />
          </div>

          {/* Next Week */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">NEXT WEEK:</label>
            <BulletList
              bullets={nextWeek}
              onChange={setNextWeek}
              placeholder="What's planned for next week…"
            />
          </div>

          {/* Notes (optional — only renders in email if filled) */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes <span className="text-gray-400">(optional — included in email if filled)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional context for the client…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 resize-y"
            />
          </div>

          {/* Operator-only notes */}
          <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Operator notes <span className="font-normal normal-case text-gray-400">(never sent to client)</span>
            </label>
            <textarea
              value={operatorNotes}
              onChange={e => setOperatorNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes, flags, follow-ups…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 bg-white resize-y"
            />
          </div>

          {msg && <p className="text-sm text-red-600">{msg}</p>}

          {!client.email && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              No client email set. Queue is disabled until you <a href={`/agency/clients/${client.id}/edit`} className="underline">add one</a>.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={saveAndQueue}
              disabled={queuing || !client.email}
              className="flex items-center gap-2 bg-[#E8622A] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#d05520] transition-colors disabled:opacity-40"
            >
              <Inbox className="w-4 h-4" />
              {queuing ? 'Queueing…' : 'Save and Queue for Approval'}
            </button>
            <button
              onClick={saveWithoutQueuing}
              disabled={saving}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Without Queuing'}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => setShowHistory(h => !h)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
        >
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Update history
          <span className="text-xs font-normal text-gray-400">({history.length})</span>
        </button>

        {showHistory && (
          <div className="mt-3 space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No updates yet.</p>
            ) : (
              history.map(u => (
                <button
                  key={u.id}
                  onClick={() => setModalUpdate(u)}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">
                      {u.sent_at ? format(parseISO(u.sent_at), 'd MMM yyyy') : 'Draft'}
                    </span>
                    {u.week_number && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Week {u.week_number}</span>
                    )}
                    {!u.sent_at && (
                      <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded">Draft</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 truncate max-w-xs">
                    {(u.content ?? '').slice(0, 60)}{(u.content ?? '').length > 60 ? '…' : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">
                  {modalUpdate.sent_at ? format(parseISO(modalUpdate.sent_at), 'd MMM yyyy') : 'Draft'}
                </p>
                {modalUpdate.week_number && <span className="text-xs text-blue-600">Week {modalUpdate.week_number}</span>}
              </div>
              <button onClick={() => setModalUpdate(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {modalUpdate.content || 'No content recorded.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

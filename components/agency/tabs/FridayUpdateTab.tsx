'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Send, CheckCircle, Clock, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import type { Client, FridayUpdate } from '@/lib/types';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

interface WeekOption {
  week_number: number;
  week_label: string;
  ends_on: string;
}

export default function FridayUpdateTab({ client }: { client: Client }) {
  const [draft,       setDraft]      = useState('');
  const [generating,  setGenerating] = useState(false);
  const [saving,      setSaving]     = useState(false);
  const [saved,       setSaved]      = useState(false);
  const [history,     setHistory]    = useState<FridayUpdate[]>([]);
  const [modalUpdate, setModalUpdate] = useState<FridayUpdate | null>(null);
  const [msg,         setMsg]        = useState('');
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [weekNumber,  setWeekNumber] = useState<number | ''>('');
  const [userId,      setUserId]     = useState<string | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const [{ data: histData }, { data: weeksData }, { data: { user } }] = await Promise.all([
      supabase.from('friday_updates').select('*').eq('client_id', client.id).not('sent_at', 'is', null).order('sent_at', { ascending: false }),
      supabase.from('client_rollout_weeks').select('week_number, week_label, ends_on').eq('client_id', client.id).order('week_number'),
      supabase.auth.getUser(),
    ]);
    setHistory((histData ?? []) as FridayUpdate[]);
    setWeekOptions((weeksData ?? []) as WeekOption[]);
    setUserId(user?.id ?? null);

    // Auto-select the current incomplete week (latest week with ends_on in the future)
    if (weeksData && weeksData.length > 0 && !weekNumber) {
      const today = new Date().toISOString().split('T')[0];
      const current = (weeksData as WeekOption[]).find(w => w.ends_on >= today);
      if (current) setWeekNumber(current.week_number);
    }
  }, [client.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const lastSent = history[0] ?? null;

  async function generateDraft() {
    if (!RAILWAY_URL) { setMsg('RAILWAY_URL not configured — write the update manually.'); return; }
    setGenerating(true);
    setSaved(false);
    setMsg('');
    try {
      const res = await fetch(`${RAILWAY_URL}/friday-update/${client.id}`, { method: 'POST' });
      const json = await res.json();
      if (json.draft) {
        setDraft(json.draft);
      } else {
        setMsg('Could not generate draft — check Railway connection.');
      }
    } catch {
      setMsg('Error connecting to backend. Check RAILWAY_URL.');
    }
    setGenerating(false);
  }

  async function saveUpdate() {
    if (!draft.trim()) return;
    setSaving(true);
    setMsg('');
    const { error } = await supabase.from('friday_updates').insert({
      client_id:       client.id,
      content:         draft.trim(),
      sent_at:         new Date().toISOString(),
      delivery_method: 'email',
      week_number:     weekNumber || null,
      sent_by_user_id: userId,
    });
    if (error) {
      setMsg(`Failed to save: ${error.message}`);
    } else {
      setSaved(true);
      setDraft('');
      loadData();
    }
    setSaving(false);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Last sent status */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock className="w-4 h-4" />
        {lastSent
          ? <>Last update sent: <span className="font-medium text-gray-700">{format(parseISO(lastSent.sent_at!), 'd MMM yyyy')}</span></>
          : 'No updates sent yet.'}
      </div>

      {/* Sent confirmation */}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          Friday update saved and marked sent.
        </div>
      )}

      {/* Draft area */}
      {!saved && (
        <div className="space-y-3">
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

          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={12}
            placeholder="Write the update here, or click 'Generate Draft' to pull this week's activity…"
            className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 font-mono resize-y"
          />

          {msg && <p className="text-sm text-[#E8622A]">{msg}</p>}

          <div className="flex gap-2">
            <button
              onClick={generateDraft}
              disabled={generating}
              className="flex items-center gap-2 bg-[#1a2744] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#243460] transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? 'Generating…' : 'Generate Draft'}
            </button>

            <button
              onClick={saveUpdate}
              disabled={!draft.trim() || saving}
              className="flex items-center gap-2 bg-[#E8622A] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#d05520] transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              {saving ? 'Saving…' : 'Mark as Sent'}
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Send the email to your client first, then click "Mark as Sent" to record it and unlock the week's completion.
          </p>
        </div>
      )}

      {saved && (
        <button
          onClick={() => setSaved(false)}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Write another update
        </button>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Previous Updates</h3>
          <div className="space-y-2">
            {history.map(u => (
              <button
                key={u.id}
                onClick={() => setModalUpdate(u)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-800">
                    {format(parseISO(u.sent_at!), 'd MMM yyyy')}
                  </span>
                  {u.week_number && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Week {u.week_number}</span>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{u.delivery_method}</span>
                </div>
                <span className="text-xs text-gray-400 truncate max-w-xs">{u.content.slice(0, 60)}…</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History modal */}
      {modalUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">{format(parseISO(modalUpdate.sent_at!), 'd MMM yyyy')}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {modalUpdate.week_number && (
                    <span className="text-xs text-blue-600">Week {modalUpdate.week_number}</span>
                  )}
                  <span className="text-xs text-gray-500">via {modalUpdate.delivery_method}</span>
                </div>
              </div>
              <button onClick={() => setModalUpdate(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{modalUpdate.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Send, CheckCircle, Clock, X, Plus } from 'lucide-react';
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
  const [notes,       setNotes]      = useState('');
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

  const lastSent = history.find(u => u.sent_at) ?? null;

  async function generateDraft() {
    if (!RAILWAY_URL) { setMsg('RAILWAY_URL not configured — write the update manually.'); return; }
    setGenerating(true);
    setSaved(false);
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
      delivery_method: 'email',
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

  return (
    <div className="p-6 space-y-6">

      {/* Last sent status */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock className="w-4 h-4 flex-shrink-0" />
        {lastSent
          ? <>Last update sent: <span className="font-medium text-gray-700">{format(parseISO(lastSent.sent_at!), 'd MMM yyyy')}</span></>
          : 'No updates logged yet.'}
      </div>

      {/* Sent confirmation */}
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

      {/* Log form */}
      {!saved && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Log a Friday update</p>
          <p className="text-xs text-gray-400">Send the email to your client outside this app, then log it here to keep track.</p>

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
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={5}
            placeholder="Paste the update content here, or leave blank to just log the date…"
            className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 bg-white resize-y"
          />

          {msg && <p className="text-sm text-[#E8622A]">{msg}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={logUpdate}
              disabled={saving}
              className="flex items-center gap-2 bg-[#E8622A] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#d05520] transition-colors disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Saving…' : 'Log Update Sent'}
            </button>

            <button
              onClick={generateDraft}
              disabled={generating}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? 'Generating…' : 'Generate Draft'}
            </button>
          </div>
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

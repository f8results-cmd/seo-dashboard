'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Send, CheckCircle, Clock, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import type { Client, FridayUpdate } from '@/lib/types';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

export default function FridayUpdateTab({ client }: { client: Client }) {
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState<FridayUpdate[]>([]);
  const [modalUpdate, setModalUpdate] = useState<FridayUpdate | null>(null);
  const [msg, setMsg] = useState('');

  const supabase = createClient();

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('friday_updates')
      .select('*')
      .eq('client_id', client.id)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false });
    setHistory((data ?? []) as FridayUpdate[]);
  }, [client.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const lastSent = history[0] ?? null;

  async function generateDraft() {
    setGenerating(true);
    setSent(false);
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

  async function sendEmail() {
    if (!draft.trim()) return;
    setSending(true);
    setMsg('');
    try {
      const res = await fetch(`${RAILWAY_URL}/send-friday-update/${client.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      });
      if (res.ok) {
        setSent(true);
        setDraft('');
        loadHistory();
      } else {
        const json = await res.json().catch(() => ({}));
        setMsg(json.detail ?? 'Email send failed.');
      }
    } catch {
      setMsg('Could not send email.');
    }
    setSending(false);
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
      {sent && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          Friday update sent successfully.
        </div>
      )}

      {/* Draft area */}
      {!sent && (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={12}
            placeholder="Click 'Generate Draft' to pull this week's activity from the system…"
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
              onClick={sendEmail}
              disabled={!draft.trim() || sending}
              className="flex items-center gap-2 bg-[#E8622A] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#d05520] transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      )}

      {sent && (
        <button
          onClick={() => setSent(false)}
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
                <p className="text-xs text-gray-500 mt-0.5">via {modalUpdate.delivery_method}</p>
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Send, Copy, Check, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import type { Client, FridayUpdate } from '@/lib/types';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

export default function FridayUpdateTab({ client }: { client: Client }) {
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<FridayUpdate[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const supabase = createClient();

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('friday_updates')
      .select('*')
      .eq('client_id', client.id)
      .order('sent_at', { ascending: false });
    setHistory((data ?? []) as FridayUpdate[]);
  }, [client.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const lastUpdate = history[0] ?? null;

  async function generateDraft() {
    setGenerating(true);
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
      const res = await fetch(`${RAILWAY_URL}/send-friday-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, content: draft }),
      });
      if (res.ok) {
        await saveAsSent('email');
        setMsg('Update sent via email.');
      } else {
        setMsg('Email send failed — save manually below.');
      }
    } catch {
      setMsg('Could not send email.');
    }
    setSending(false);
  }

  async function saveAsSent(method = 'manual') {
    await supabase.from('friday_updates').insert({
      client_id: client.id,
      content: draft,
      delivery_method: method,
    });
    await supabase.from('clients').update({ last_friday_update: new Date().toISOString() }).eq('id', client.id);
    setDraft('');
    loadHistory();
    setMsg('Update saved.');
  }

  function copy() {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Last update status */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock className="w-4 h-4" />
        {lastUpdate
          ? <>Last update sent: <span className="font-medium text-gray-700">{format(parseISO(lastUpdate.sent_at), 'd MMM yyyy')}</span></>
          : 'No updates sent yet.'}
      </div>

      {/* Generate */}
      <div className="space-y-3">
        <button
          onClick={generateDraft}
          disabled={generating}
          className="flex items-center gap-2 bg-[#1a2744] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#243460] transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {generating ? 'Generating draft…' : 'Generate AI Draft'}
        </button>

        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={12}
          placeholder="AI draft will appear here — you can edit before sending…"
          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 font-mono resize-y"
        />

        {msg && <p className="text-sm text-[#E8622A]">{msg}</p>}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={sendEmail}
            disabled={!draft.trim() || sending}
            className="flex items-center gap-1.5 bg-[#E8622A] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#d05520] transition-colors disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Sending…' : 'Send Email'}
          </button>
          <button
            onClick={copy}
            disabled={!draft.trim()}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy (SMS/WhatsApp)'}
          </button>
          <button
            onClick={() => saveAsSent('manual')}
            disabled={!draft.trim()}
            className="border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            Save as Sent
          </button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Previous Updates</h3>
          <div className="space-y-2">
            {history.map(u => (
              <div key={u.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-800">
                      {format(parseISO(u.sent_at), 'd MMM yyyy')}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{u.delivery_method}</span>
                  </div>
                  <span className="text-xs text-gray-400">{u.content.slice(0, 60)}…</span>
                </button>
                {expandedId === u.id && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans mt-3">{u.content}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

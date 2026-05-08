'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Clock, CheckCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import type { Client, FridayUpdate } from '@/lib/types';

export default function FridayUpdateTab({ client }: { client: Client }) {
  const supabase = createClient();

  const [emailText,   setEmailText]   = useState('');
  const [history,     setHistory]     = useState<FridayUpdate[]>([]);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [msg,         setMsg]         = useState('');
  const [showHistory, setShowHistory] = useState(true);
  const [modalUpdate, setModalUpdate] = useState<FridayUpdate | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: histData }, { data: { user } }] = await Promise.all([
      supabase
        .from('friday_updates')
        .select('*')
        .eq('client_id', client.id)
        .order('sent_at', { ascending: false })
        .limit(50),
      supabase.auth.getUser(),
    ]);
    setHistory((histData ?? []) as FridayUpdate[]);
    setUserId(user?.id ?? null);
  }, [client.id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function logUpdate() {
    if (!emailText.trim()) { setMsg('Paste the email text first.'); return; }
    setSaving(true);
    setMsg('');

    const now = new Date().toISOString();
    const { error } = await supabase.from('friday_updates').insert({
      client_id:       client.id,
      content:         emailText.trim(),
      sent_at:         now,
      delivery_method: 'manual',
      sent_by_user_id: userId,
    });

    if (error) {
      setMsg(`Failed to save: ${error.message}`);
    } else {
      await supabase
        .from('clients')
        .update({ last_friday_update: now })
        .eq('id', client.id);
      setEmailText('');
      setSaved(true);
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
          ? <>Last update logged: <span className="font-medium text-gray-700">{format(parseISO(lastSent.sent_at!), 'd MMM yyyy')}</span></>
          : 'No updates logged yet.'}
      </div>

      {/* Success banner */}
      {saved && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Update logged.</div>
          <button onClick={() => setSaved(false)} className="font-medium hover:text-green-900">Log another</button>
        </div>
      )}

      {/* Log form */}
      {!saved && (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-800">
            Paste Friday update email
            <span className="font-normal text-gray-400 ml-2 text-xs">sent to {client.owner_name ?? 'client'}</span>
          </label>
          <textarea
            value={emailText}
            onChange={e => { setEmailText(e.target.value); setMsg(''); }}
            rows={10}
            placeholder={`Hey ${(client.owner_name ?? '').split(' ')[0] || 'there'},\n\nPaste the email you sent here…`}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 resize-y font-mono leading-relaxed"
          />
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <button
            onClick={logUpdate}
            disabled={saving || !emailText.trim()}
            className="flex items-center gap-2 bg-[#E8622A] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#d05520] transition-colors disabled:opacity-40"
          >
            <FileText className="w-4 h-4" />
            {saving ? 'Saving…' : 'Log Update'}
          </button>
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
              <p className="text-sm text-gray-400 py-2">No updates logged yet.</p>
            ) : (
              history.map(u => (
                <button
                  key={u.id}
                  onClick={() => setModalUpdate(u)}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800 shrink-0">
                    {u.sent_at ? format(parseISO(u.sent_at), 'd MMM yyyy') : 'Draft'}
                  </span>
                  <span className="text-xs text-gray-400 truncate max-w-xs ml-4">
                    {(u.content ?? '').slice(0, 80)}{(u.content ?? '').length > 80 ? '…' : ''}
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
              <p className="font-semibold text-gray-900">
                {modalUpdate.sent_at ? format(parseISO(modalUpdate.sent_at), 'd MMM yyyy') : 'Draft'}
              </p>
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

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StickyNote, Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import type { Client, ClientNote } from '@/lib/types';

// ── Notes list + input (shared between desktop sidebar and mobile drawer) ────

function SidebarContent({ client }: { client: Client }) {
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: true });
    setNotes((data ?? []) as ClientNote[]);
    setLoading(false);
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  // Scroll to newest note after load or insert
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes.length]);

  async function addNote() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    const { data } = await supabase
      .from('client_notes')
      .insert({ client_id: client.id, note: trimmed })
      .select()
      .single();
    if (data) setNotes(prev => [...prev, data as ClientNote]);
    setText('');
    setSaving(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      addNote();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable notes list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-2.5 bg-gray-200 rounded w-28" />
                <div className="h-12 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            No notes yet — add one below.
          </p>
        ) : (
          notes.map(note => (
            <div key={note.id}>
              <p className="text-xs text-gray-400 mb-1">
                {format(parseISO(note.created_at), 'd MMM yy, h:mm a')}
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {note.note}
              </p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Fixed input at bottom */}
      <div className="border-t border-gray-100 p-3 flex-shrink-0">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note… (⌘↵ to save)"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#E8622A] focus:border-[#E8622A] placeholder:text-gray-400"
        />
        <button
          onClick={addNote}
          disabled={saving || !text.trim()}
          className="mt-1.5 w-full flex items-center justify-center gap-1.5 bg-[#1a2744] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#243561] transition-colors disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Add Note'}
        </button>
      </div>
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────────────

interface Props {
  client: Client;
}

export default function NotesSidebar({ client }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Desktop sticky sidebar */}
      <aside className="hidden lg:flex w-[250px] flex-shrink-0 flex-col self-start sticky top-6">
        <div
          className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col"
          style={{ maxHeight: 'calc(100vh - 56px)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
            <StickyNote className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Notes</h2>
          </div>
          <div className="flex flex-col flex-1 min-h-0">
            <SidebarContent client={client} />
          </div>
        </div>
      </aside>

      {/* Mobile floating button — bottom-left */}
      <div className="lg:hidden fixed bottom-6 left-6 z-40">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 bg-[#1a2744] text-white px-4 py-3 rounded-full shadow-lg text-sm font-medium hover:bg-[#243561] transition-colors"
        >
          <StickyNote className="w-4 h-4" /> Notes
        </button>
      </div>

      {/* Mobile bottom drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-gray-400" /> Notes
              </h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <SidebarContent client={client} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

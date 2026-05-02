'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, CheckCircle2, Clock, X, Loader2 } from 'lucide-react';
import DevChatPanel from '@/components/agency/DevChatPanel';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

interface Thread {
  id: string;
  title: string;
  status: 'open' | 'resolved';
  client_id: string | null;
  clients?: { business_name: string } | null;
  github_issue_url?: string | null;
  created_at: string;
  updated_at: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  onClick: () => void;
}

function ThreadItem({ thread, isActive, onClick }: ThreadItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-[#1a2744] text-white'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
            {thread.title}
          </p>
          <div className={`flex items-center gap-1.5 mt-0.5 text-xs ${isActive ? 'text-slate-300' : 'text-gray-400'}`}>
            {thread.clients?.business_name && (
              <>
                <span className="truncate max-w-[100px]">{thread.clients.business_name}</span>
                <span>·</span>
              </>
            )}
            <span>{timeAgo(thread.updated_at)}</span>
          </div>
        </div>
        {thread.status === 'resolved' && (
          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isActive ? 'text-green-300' : 'text-green-500'}`} />
        )}
      </div>
    </button>
  );
}

interface NewChatModalProps {
  onClose: () => void;
  onCreate: (thread: Thread) => void;
}

function NewChatModal({ onClose, onCreate }: NewChatModalProps) {
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${RAILWAY_URL}/dev-chat/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const thread = (await res.json()) as Thread;
      onCreate(thread);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create thread');
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">New Chat</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="chat-title">
              What do you want to discuss?
            </label>
            <input
              id="chat-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. GBP posts not generating for Adelaide Car Detailing"
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30 focus:border-[#1a2744] transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || creating}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E8622A] text-white text-sm font-semibold hover:bg-[#d4541f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? 'Starting…' : 'Start Chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DevChatPage() {
  const [threads, setThreads]           = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [showModal, setShowModal]       = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch(`${RAILWAY_URL}/dev-chat/threads`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { threads: Thread[] };
      setThreads(data.threads ?? []);
    } catch (err) {
      console.error('Failed to load threads:', err);
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  function handleThreadCreated(thread: Thread) {
    setThreads(prev => [thread, ...prev]);
    setSelectedId(thread.id);
    setShowModal(false);
  }

  function handleThreadUpdate() {
    loadThreads();
  }

  const openThreads     = threads.filter(t => t.status === 'open');
  const resolvedThreads = threads.filter(t => t.status === 'resolved');

  return (
    <>
      <div className="flex h-[calc(100vh-0px)] md:h-screen overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-[300px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
          {/* Sidebar header */}
          <div className="px-4 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-base font-semibold text-gray-900">Dev Chat</h1>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E8622A] text-white text-sm font-semibold hover:bg-[#d4541f] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {threadsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8 px-4">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No threads yet. Start a new chat!
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {/* Open threads */}
                {openThreads.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-3 py-2">
                      <Clock className="w-3.5 h-3.5 text-[#E8622A]" />
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        Open ({openThreads.length})
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {openThreads.map(thread => (
                        <ThreadItem
                          key={thread.id}
                          thread={thread}
                          isActive={selectedId === thread.id}
                          onClick={() => setSelectedId(thread.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolved threads */}
                {resolvedThreads.length > 0 && (
                  <div className={openThreads.length > 0 ? 'mt-4' : ''}>
                    <div className="flex items-center gap-1.5 px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        Resolved ({resolvedThreads.length})
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {resolvedThreads.map(thread => (
                        <ThreadItem
                          key={thread.id}
                          thread={thread}
                          isActive={selectedId === thread.id}
                          onClick={() => setSelectedId(thread.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Right panel */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {selectedId ? (
            <DevChatPanel
              key={selectedId}
              threadId={selectedId}
              onThreadUpdate={handleThreadUpdate}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Select a thread or start a new chat</p>
              <p className="text-gray-400 text-sm mt-1 max-w-xs">
                Ask Claude about platform issues, bugs, or features. It will analyse your message and suggest next steps.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E8622A] text-white text-sm font-semibold hover:bg-[#d4541f] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Start a new chat
              </button>
            </div>
          )}
        </main>
      </div>

      {showModal && (
        <NewChatModal
          onClose={() => setShowModal(false)}
          onCreate={handleThreadCreated}
        />
      )}
    </>
  );
}

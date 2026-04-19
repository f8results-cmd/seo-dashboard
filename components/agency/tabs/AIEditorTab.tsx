'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Sparkles, Check, X, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import type { Client } from '@/lib/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface DiffEntry {
  old: unknown;
  new: unknown;
}

interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  diff?: Record<string, DiffEntry> | null;
  confirmed?: boolean;
  commit_sha?: string | null;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFieldPath(path: string): string {
  const parts = path.split('.');
  return parts
    .filter(p => isNaN(Number(p)))
    .map(p => p.replace(/_/g, ' '))
    .join(' → ');
}

function truncateValue(val: unknown, maxLen = 80): string {
  if (val === null || val === undefined) return '(empty)';
  const str = typeof val === 'string' ? val : JSON.stringify(val);
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ── DiffPreview ───────────────────────────────────────────────────────────────

function DiffPreview({
  diff,
  turnId,
  confirmed,
  commitSha,
  onConfirm,
}: {
  diff: Record<string, DiffEntry>;
  turnId: string;
  confirmed: boolean;
  commitSha?: string | null;
  onConfirm: (turnId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const fields = Object.entries(diff);
  if (fields.length === 0) return null;

  return (
    <div className={`mt-2 rounded-lg border text-xs overflow-hidden
      ${confirmed ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 font-medium text-left"
      >
        <span className={confirmed ? 'text-green-700' : 'text-blue-700'}>
          {confirmed
            ? `Applied — ${fields.length} field${fields.length !== 1 ? 's' : ''} changed`
            : `Proposed changes (${fields.length} field${fields.length !== 1 ? 's' : ''})`}
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-inherit">
          <div className="divide-y divide-inherit">
            {fields.map(([path, change]) => (
              <div key={path} className="px-3 py-2 space-y-1">
                <div className="font-mono text-xs text-gray-500">{formatFieldPath(path)}</div>
                <div className="flex gap-2 items-start">
                  <div className="flex-1 bg-red-50 border border-red-200 rounded px-2 py-1 line-through text-red-700 break-all">
                    {truncateValue(change.old)}
                  </div>
                  <div className="text-gray-400 mt-1">→</div>
                  <div className="flex-1 bg-green-50 border border-green-200 rounded px-2 py-1 text-green-700 font-medium break-all">
                    {truncateValue(change.new)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!confirmed && (
            <div className="px-3 py-2 flex gap-2 border-t border-blue-200">
              <button
                onClick={() => onConfirm(turnId)}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#E8622A] rounded-lg px-3 py-1.5 hover:bg-[#d05520]"
              >
                <Check className="w-3 h-3" /> Apply & push to GitHub
              </button>
              <span className="text-xs text-gray-400 self-center">
                This will trigger a Vercel rebuild
              </span>
            </div>
          )}

          {confirmed && commitSha && (
            <div className="px-3 py-2 border-t border-green-200 text-green-700 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Committed: <code className="font-mono">{commitSha.slice(0, 8)}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  turn,
  onConfirm,
}: {
  turn: ConversationTurn;
  onConfirm: (turnId: string) => void;
}) {
  const isUser = turn.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? '' : 'w-full'}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#E8622A]" />
            <span className="text-xs font-medium text-gray-500">AI Editor</span>
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
            ${isUser
              ? 'bg-[#E8622A] text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}
        >
          {turn.content}
        </div>

        {/* Diff preview for assistant turns */}
        {!isUser && turn.diff && Object.keys(turn.diff).length > 0 && (
          <DiffPreview
            diff={turn.diff}
            turnId={turn.id}
            confirmed={turn.confirmed ?? false}
            commitSha={turn.commit_sha}
            onConfirm={onConfirm}
          />
        )}
      </div>
    </div>
  );
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Update the homepage meta description',
  'Rewrite the tagline to be more compelling',
  'Fix the About page hero title',
  'Update the primary keyword',
  'Make the homepage H1 more SEO-focused',
];

// ── Main component ───────────────────────────────────────────────────────────

export default function AIEditorTab({ client }: { client: Client }) {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const liveUrl = client.live_url ?? '';

  // ── Load conversation history ─────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/ai-edit`);
      if (res.ok) {
        const { turns: data } = await res.json();
        setTurns(data ?? []);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [client.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Auto-scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage(text: string) {
    const msg = text.trim();
    if (!msg || sending) return;

    setInput('');
    setError('');
    setSending(true);

    // Optimistically add user turn
    const optimisticUser: ConversationTurn = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    };
    setTurns(prev => [...prev, optimisticUser]);

    try {
      const res = await fetch(`/api/clients/${client.id}/ai-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const assistantTurn: ConversationTurn = {
        id: data.turn_id,
        role: 'assistant',
        content: data.reply,
        diff: data.diff,
        confirmed: false,
        created_at: new Date().toISOString(),
      };
      setTurns(prev => [
        ...prev.filter(t => t.id !== optimisticUser.id),
        { ...optimisticUser, id: `user-${Date.now()}` },
        assistantTurn,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setTurns(prev => prev.filter(t => t.id !== optimisticUser.id));
    } finally {
      setSending(false);
    }
  }

  // ── Confirm / apply changes ───────────────────────────────────────────────
  async function confirmTurn(turnId: string) {
    setConfirming(turnId);
    setError('');
    try {
      const res = await fetch(`/api/clients/${client.id}/ai-edit/confirm/${turnId}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTurns(prev => prev.map(t =>
        t.id === turnId
          ? { ...t, confirmed: true, commit_sha: data.commit_sha }
          : t
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setConfirming(null);
    }
  }

  // ── Textarea auto-resize ──────────────────────────────────────────────────
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[680px]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#E8622A]" />
          <span className="text-sm font-semibold text-gray-800">AI Website Editor</span>
          <span className="text-xs text-gray-400">— chat to edit {client.business_name}</span>
        </div>
        <div className="flex items-center gap-2">
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#E8622A] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Live site
            </a>
          )}
          <button
            onClick={loadHistory}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
            title="Refresh history"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-gray-400">Loading conversation…</div>
          </div>
        ) : turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 text-center px-8">
            <Sparkles className="w-8 h-8 text-[#E8622A]/40" />
            <p className="text-sm text-gray-500">
              Chat with the AI to edit your client&apos;s website. Changes are previewed as diffs
              and only applied when you confirm.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs text-[#E8622A] bg-orange-50 border border-orange-200 rounded-full px-3 py-1.5 hover:bg-orange-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {turns.map(turn => (
              <MessageBubble
                key={turn.id}
                turn={turn}
                onConfirm={confirmTurn}
              />
            ))}

            {/* Sending indicator */}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#E8622A] animate-pulse" />
                  <span className="text-xs text-gray-500">Thinking…</span>
                </div>
              </div>
            )}

            {/* Confirming indicator */}
            {confirming && (
              <div className="text-xs text-center text-gray-400 animate-pulse">
                Applying changes and pushing to GitHub…
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <X className="w-3.5 h-3.5 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex items-end gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#E8622A]/30 bg-white">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to change? (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none text-sm text-gray-800 placeholder-gray-400 focus:outline-none leading-relaxed disabled:opacity-50 min-h-[24px] max-h-[120px]"
            style={{ height: '24px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[#E8622A] text-white hover:bg-[#d05520] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Changes are shown as diffs and only go live when you click &ldquo;Apply &amp; push&rdquo;
        </p>
      </div>
    </div>
  );
}

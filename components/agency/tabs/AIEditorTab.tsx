'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Sparkles, Check, X, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, Plus, Trash2, Image, List,
  ArrowUpDown, Palette, HelpCircle, Type,
} from 'lucide-react';
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

// ── Diff helpers ──────────────────────────────────────────────────────────────

/** Detect operation type from the display key string */
function opCategory(key: string): 'add' | 'remove' | 'photo' | 'reorder' | 'faq' | 'brand' | 'field' {
  if (key.startsWith('services → add:')) return 'add';
  if (key.startsWith('services → remove:')) return 'remove';
  if (key.startsWith('photo →')) return 'photo';
  if (key === 'services → reorder') return 'reorder';
  if (key.startsWith('faq →')) return 'faq';
  if (key.startsWith('branding →')) return 'brand';
  return 'field';
}

const OP_ICONS: Record<ReturnType<typeof opCategory>, React.ReactNode> = {
  add:    <Plus className="w-3 h-3 text-green-600" />,
  remove: <Trash2 className="w-3 h-3 text-red-600" />,
  photo:  <Image className="w-3 h-3 text-blue-600" />,
  reorder:<ArrowUpDown className="w-3 h-3 text-purple-600" />,
  faq:    <HelpCircle className="w-3 h-3 text-orange-600" />,
  brand:  <Palette className="w-3 h-3 text-indigo-600" />,
  field:  <Type className="w-3 h-3 text-gray-500" />,
};

function formatFieldLabel(key: string): string {
  // Structural ops already have a human-readable key
  if (key.includes('→')) return key;
  // Dot-notation path → human readable
  return key
    .split('.')
    .filter(p => isNaN(Number(p)))
    .map(p => p.replace(/_/g, ' '))
    .join(' › ');
}

function formatValue(val: unknown, maxLen = 120): string {
  if (val === null || val === undefined) return '(none)';
  if (typeof val === 'string') {
    return val.length > maxLen ? val.slice(0, maxLen) + '…' : val;
  }
  if (Array.isArray(val)) {
    const items = val.map((v) =>
      typeof v === 'string' ? v : (v as Record<string, unknown>)?.name ?? JSON.stringify(v)
    );
    const joined = items.join(', ');
    return joined.length > maxLen ? joined.slice(0, maxLen) + '…' : joined;
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const name = obj.name ?? obj.question ?? obj.title;
    if (name) return `{ ${name} }`;
    const str = JSON.stringify(val);
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
  }
  return String(val);
}

// ── DiffPreview ───────────────────────────────────────────────────────────────

function DiffPreview({
  diff,
  turnId,
  confirmed,
  commitSha,
  onConfirm,
  confirming,
}: {
  diff: Record<string, DiffEntry>;
  turnId: string;
  confirmed: boolean;
  commitSha?: string | null;
  onConfirm: (turnId: string) => void;
  confirming: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  // Filter internal _ops key from display
  const fields = Object.entries(diff).filter(([k]) => !k.startsWith('_'));
  if (fields.length === 0) return null;

  const borderColor = confirmed ? 'border-green-200' : 'border-blue-200';
  const bgColor     = confirmed ? 'bg-green-50'     : 'bg-blue-50';
  const headColor   = confirmed ? 'text-green-700'  : 'text-blue-700';

  return (
    <div className={`mt-2 rounded-lg border text-xs overflow-hidden ${borderColor} ${bgColor}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 font-medium text-left"
      >
        <span className={headColor}>
          {confirmed
            ? `Applied — ${fields.length} change${fields.length !== 1 ? 's' : ''}`
            : `Proposed changes (${fields.length})`}
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-inherit">
          <div className="divide-y divide-inherit">
            {fields.map(([key, change]) => {
              const cat = opCategory(key);
              const icon = OP_ICONS[cat];
              const label = formatFieldLabel(key);
              const isAddition = change.old === null;
              const isDeletion = change.new === null;
              const isReorder  = cat === 'reorder';

              return (
                <div key={key} className="px-3 py-2 space-y-1">
                  <div className="flex items-center gap-1.5 font-mono text-gray-500">
                    {icon}
                    <span>{label}</span>
                  </div>

                  {isReorder ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-red-50 border border-red-200 rounded px-2 py-1 text-red-700 line-through break-all">
                        {formatValue(change.old)}
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded px-2 py-1 text-green-700 font-medium break-all">
                        {formatValue(change.new)}
                      </div>
                    </div>
                  ) : isAddition ? (
                    <div className="bg-green-50 border border-green-200 rounded px-2 py-1 text-green-700 font-medium break-all">
                      + {formatValue(change.new)}
                    </div>
                  ) : isDeletion ? (
                    <div className="bg-red-50 border border-red-200 rounded px-2 py-1 text-red-700 line-through break-all">
                      − {formatValue(change.old)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-red-50 border border-red-200 rounded px-2 py-1 text-red-700 line-through break-all">
                        {formatValue(change.old)}
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded px-2 py-1 text-green-700 font-medium break-all">
                        {formatValue(change.new)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action bar */}
          {!confirmed && (
            <div className="px-3 py-2 flex gap-2 items-center border-t border-blue-200">
              <button
                onClick={() => onConfirm(turnId)}
                disabled={confirming}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#E8622A] rounded-lg px-3 py-1.5 hover:bg-[#d05520] disabled:opacity-60 disabled:cursor-wait"
              >
                {confirming ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Applying…
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3" />
                    Apply &amp; push to GitHub
                  </>
                )}
              </button>
              <span className="text-xs text-gray-400">Triggers a Vercel rebuild</span>
            </div>
          )}

          {confirmed && commitSha && (
            <div className="px-3 py-2 border-t border-green-200 text-green-700 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Committed:&nbsp;
              <code className="font-mono">{commitSha.slice(0, 8)}</code>
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
  confirming,
}: {
  turn: ConversationTurn;
  onConfirm: (turnId: string) => void;
  confirming: string | null;
}) {
  const isUser = turn.role === 'user';
  const hasDiff = !isUser && turn.diff && Object.keys(turn.diff).filter(k => !k.startsWith('_')).length > 0;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[82%] ${isUser ? '' : 'w-full'}`}>
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
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}
        >
          {turn.content}
        </div>

        {hasDiff && turn.diff && (
          <DiffPreview
            diff={turn.diff}
            turnId={turn.id}
            confirmed={turn.confirmed ?? false}
            commitSha={turn.commit_sha}
            onConfirm={onConfirm}
            confirming={confirming === turn.id}
          />
        )}
      </div>
    </div>
  );
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: 'Update tagline', icon: <Type className="w-3 h-3" />, prompt: 'Rewrite the homepage tagline to be more compelling and include the primary keyword' },
  { label: 'Fix meta description', icon: <Type className="w-3 h-3" />, prompt: 'Update the homepage meta description — make it 140–155 characters and include a call to action' },
  { label: 'Add a service', icon: <Plus className="w-3 h-3" />, prompt: 'Add a new service to the services list — ask me for details' },
  { label: 'Remove a service', icon: <Trash2 className="w-3 h-3" />, prompt: 'Remove a service from the services list — which one should we remove?' },
  { label: 'Change hero photo', icon: <Image className="w-3 h-3" />, prompt: 'Show me the available photos and let me pick a new hero image' },
  { label: 'Add a FAQ', icon: <HelpCircle className="w-3 h-3" />, prompt: 'Add a FAQ question to the homepage — ask me for the question and answer' },
  { label: 'Reorder services', icon: <List className="w-3 h-3" />, prompt: 'Show the current service order and let me decide the new order' },
  { label: 'About page rewrite', icon: <Type className="w-3 h-3" />, prompt: 'Rewrite the opening paragraph of the About page to be shorter and more direct' },
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

  // ── Auto-scroll ───────────────────────────────────────────────────────────
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
      textareaRef.current?.focus();
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

  // ── Input handlers ────────────────────────────────────────────────────────
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
    <div className="flex flex-col h-[720px]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#E8622A]" />
          <span className="text-sm font-semibold text-gray-800">AI Website Editor</span>
          <span className="text-xs text-gray-400">— {client.business_name}</span>
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
          /* Empty state with suggestions */
          <div className="flex flex-col items-center justify-center h-full space-y-5 text-center px-8">
            <Sparkles className="w-8 h-8 text-[#E8622A]/40" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Chat to edit {client.business_name}&apos;s website</p>
              <p className="text-xs text-gray-400">
                Changes are shown as diffs before anything goes live. Only applied when you click &quot;Apply &amp; push&quot;.
              </p>
            </div>
            <div className="w-full max-w-lg">
              <p className="text-xs text-gray-400 mb-2 text-left">Suggested edits:</p>
              <div className="grid grid-cols-2 gap-2 text-left">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.label}
                    onClick={() => sendMessage(s.prompt)}
                    className="flex items-center gap-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-[#E8622A]/50 hover:bg-orange-50 transition-colors text-left"
                  >
                    <span className="text-gray-400 shrink-0">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {turns.map(turn => (
              <MessageBubble
                key={turn.id}
                turn={turn}
                onConfirm={confirmTurn}
                confirming={confirming}
              />
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#E8622A] animate-pulse" />
                  <span className="text-xs text-gray-500">Thinking…</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error bar */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <X className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
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
            placeholder="What would you like to change? (Enter to send)"
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
          Supports: text edits, add/remove services, photo changes, FAQ entries, brand colours — all previewed before going live
        </p>
      </div>
    </div>
  );
}

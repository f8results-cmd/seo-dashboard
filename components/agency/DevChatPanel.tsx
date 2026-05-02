'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, Loader2, GitBranch, CheckCircle2, AlertCircle, HelpCircle, Wrench, BarChart2, Lightbulb } from 'lucide-react';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

interface Message {
  id: string;
  thread_id: string;
  sender: 'operator' | 'ai';
  content: string;
  created_at: string;
}

interface AIResponse {
  understanding: string;
  category: 'bug_fix' | 'feature_request' | 'data_question' | 'operational_help' | 'clarification_needed';
  suggested_action: string;
  next_steps: 'auto_resolve' | 'create_github_issue' | 'needs_clarification';
  github_issue_title?: string;
  github_issue_body?: string;
}

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

interface DevChatPanelProps {
  threadId: string;
  onThreadUpdate: () => void;
}

const CATEGORY_CONFIG: Record<
  AIResponse['category'],
  { label: string; className: string; icon: React.ElementType }
> = {
  bug_fix:             { label: 'Bug Fix',            className: 'bg-red-100 text-red-700',     icon: Wrench },
  feature_request:     { label: 'Feature Request',    className: 'bg-blue-100 text-blue-700',   icon: Lightbulb },
  data_question:       { label: 'Data Question',      className: 'bg-purple-100 text-purple-700', icon: BarChart2 },
  operational_help:    { label: 'Operational Help',   className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  clarification_needed:{ label: 'Needs Clarification',className: 'bg-yellow-100 text-yellow-700', icon: HelpCircle },
};

const NEXT_STEPS_CONFIG: Record<
  AIResponse['next_steps'],
  { label: string; className: string }
> = {
  auto_resolve:         { label: 'Auto Resolve',          className: 'bg-green-100 text-green-700' },
  create_github_issue:  { label: 'Create GitHub Issue',   className: 'bg-blue-100 text-blue-700' },
  needs_clarification:  { label: 'Needs Clarification',   className: 'bg-yellow-100 text-yellow-700' },
};

function AIMessageCard({
  parsed,
  msgId,
  threadGithubUrl,
  onIssueCreated,
}: {
  parsed: AIResponse;
  msgId: string;
  threadGithubUrl: string | null | undefined;
  onIssueCreated: (url: string) => void;
}) {
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  const cat = CATEGORY_CONFIG[parsed.category] ?? CATEGORY_CONFIG.clarification_needed;
  const ns  = NEXT_STEPS_CONFIG[parsed.next_steps] ?? NEXT_STEPS_CONFIG.needs_clarification;
  const CatIcon = cat.icon;

  async function handleCreateIssue() {
    setCreatingIssue(true);
    setIssueError(null);
    try {
      const res = await fetch(`${RAILWAY_URL}/dev-chat/threads/${msgId.split('__')[0]}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `Create GitHub issue: ${parsed.github_issue_title ?? parsed.understanding}`,
          auto_create_issue: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { response: AIResponse; github_issue_url?: string };
      if (data.github_issue_url) {
        setIssueUrl(data.github_issue_url);
        onIssueCreated(data.github_issue_url);
      }
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setCreatingIssue(false);
    }
  }

  const effectiveIssueUrl = issueUrl ?? threadGithubUrl;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm max-w-[80%]">
      {/* Category badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cat.className}`}>
          <CatIcon className="w-3 h-3" />
          {cat.label}
        </span>
      </div>

      {/* Understanding */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Understanding</p>
        <p className="text-sm text-gray-800 leading-relaxed">{parsed.understanding}</p>
      </div>

      {/* Suggested action */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Suggested Action</p>
        <p className="text-sm text-gray-800 leading-relaxed">{parsed.suggested_action}</p>
      </div>

      {/* Next steps badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${ns.className}`}>
          Next: {ns.label}
        </span>

        {/* GitHub issue actions */}
        {parsed.next_steps === 'create_github_issue' && !effectiveIssueUrl && (
          <button
            onClick={handleCreateIssue}
            disabled={creatingIssue}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#1a2744] text-white hover:bg-[#243460] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {creatingIssue ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <GitBranch className="w-3 h-3" />
            )}
            {creatingIssue ? 'Creating…' : 'Create GitHub Issue'}
          </button>
        )}

        {effectiveIssueUrl && (
          <a
            href={effectiveIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
          >
            <GitBranch className="w-3 h-3" />
            View GitHub Issue
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {issueError && (
          <span className="inline-flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="w-3 h-3" />
            {issueError}
          </span>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  threadGithubUrl,
  onIssueCreated,
}: {
  msg: Message;
  threadGithubUrl: string | null | undefined;
  onIssueCreated: (url: string) => void;
}) {
  const isOperator = msg.sender === 'operator';
  const timestamp = new Date(msg.created_at).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isOperator) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <div className="bg-[#1a2744] text-white rounded-xl px-4 py-3 text-sm leading-relaxed">
            {msg.content}
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">{timestamp}</p>
        </div>
      </div>
    );
  }

  // AI message — try to parse JSON
  let parsed: AIResponse | null = null;
  try {
    parsed = JSON.parse(msg.content) as AIResponse;
  } catch {
    // fallback to raw text
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%]">
        {parsed ? (
          <AIMessageCard
            parsed={parsed}
            msgId={`${msg.thread_id}__${msg.id}`}
            threadGithubUrl={threadGithubUrl}
            onIssueCreated={onIssueCreated}
          />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 leading-relaxed shadow-sm">
            {msg.content}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-1">{timestamp}</p>
      </div>
    </div>
  );
}

export default function DevChatPanel({ threadId, onThreadUpdate }: DevChatPanelProps) {
  const [thread, setThread]     = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(true);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_CHARS = 4000;

  const loadThread = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${RAILWAY_URL}/dev-chat/threads/${threadId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Thread & { messages?: Message[] };
      setThread(data);
      setMessages(data.messages ?? []);
    } catch (err) {
      console.error('Failed to load thread:', err);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setSendError(null);

    // Optimistic operator message
    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      thread_id: threadId,
      sender: 'operator',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');

    try {
      const res = await fetch(`${RAILWAY_URL}/dev-chat/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { response: AIResponse; github_issue_url?: string };

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        thread_id: threadId,
        sender: 'ai',
        content: JSON.stringify(data.response),
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);

      if (data.github_issue_url && thread) {
        setThread(prev => prev ? { ...prev, github_issue_url: data.github_issue_url } : prev);
        onThreadUpdate();
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setInput(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  async function handleMarkResolved() {
    if (!thread || resolving) return;
    setResolving(true);
    try {
      const res = await fetch(`${RAILWAY_URL}/dev-chat/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setThread(prev => prev ? { ...prev, status: 'resolved' } : prev);
      onThreadUpdate();
    } catch (err) {
      console.error('Failed to mark resolved:', err);
    } finally {
      setResolving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleIssueCreated(url: string) {
    setThread(prev => prev ? { ...prev, github_issue_url: url } : prev);
    onThreadUpdate();
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Failed to load thread.
      </div>
    );
  }

  const charsLeft = MAX_CHARS - input.length;
  const nearLimit = charsLeft < 200;

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">{thread.title}</h2>
          {thread.clients?.business_name && (
            <p className="text-xs text-gray-500 mt-0.5">{thread.clients.business_name}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status badge */}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            thread.status === 'resolved'
              ? 'bg-green-100 text-green-700'
              : 'bg-[#E8622A]/10 text-[#E8622A]'
          }`}>
            {thread.status === 'resolved' ? 'Resolved' : 'Open'}
          </span>

          {/* GitHub issue link */}
          {thread.github_issue_url && (
            <a
              href={thread.github_issue_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" />
              GitHub Issue
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Mark resolved */}
          {thread.status === 'open' && (
            <button
              onClick={handleMarkResolved}
              disabled={resolving}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {resolving ? 'Resolving…' : 'Mark resolved'}
            </button>
          )}
        </div>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            No messages yet. Ask Claude anything about the platform.
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            threadGithubUrl={thread.github_issue_url}
            onIssueCreated={handleIssueCreated}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-5 py-4">
        {sendError && (
          <div className="flex items-center gap-2 text-xs text-red-600 mb-2">
            <AlertCircle className="w-3.5 h-3.5" />
            {sendError}
          </div>
        )}
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={3}
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={handleKeyDown}
              placeholder={thread.status === 'resolved' ? 'Thread is resolved.' : 'Ask Claude about the platform… (Enter to send, Shift+Enter for newline)'}
              disabled={thread.status === 'resolved' || sending}
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30 focus:border-[#1a2744] disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            />
            {nearLimit && (
              <p className={`absolute bottom-2 right-3 text-xs ${charsLeft < 50 ? 'text-red-500' : 'text-gray-400'}`}>
                {charsLeft}
              </p>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || thread.status === 'resolved'}
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#E8622A] text-white text-sm font-semibold hover:bg-[#d4541f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

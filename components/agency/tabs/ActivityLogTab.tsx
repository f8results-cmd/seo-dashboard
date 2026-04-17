'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, Zap, Globe, FileText, MapPin, Star, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import type { Job, ScheduledJob, GbpPost, ClientNote } from '@/lib/types';

const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  research_agent:  Globe,
  content_agent:   FileText,
  design_agent:    FileText,
  deploy_agent:    Globe,
  gbp_agent:       MapPin,
  citation_agent:  Star,
  suburb_agent:    MapPin,
  report_agent:    FileText,
};

const AGENT_LABELS: Record<string, string> = {
  research_agent:  'Research',
  content_agent:   'Content',
  design_agent:    'Design',
  deploy_agent:    'Deploy',
  gbp_agent:       'GBP Setup',
  citation_agent:  'Citations',
  suburb_agent:    'Suburb Pages',
  report_agent:    'Report',
};

type FeedItem = {
  id: string;
  type: 'job' | 'scheduled' | 'gbp_post' | 'note';
  timestamp: string;
  label: string;
  detail?: string;
  status?: string;
};

function ItemIcon({ item }: { item: FeedItem }) {
  if (item.type === 'note') return <FileText className="w-4 h-4 text-purple-500" />;
  if (item.type === 'gbp_post') return <MapPin className="w-4 h-4 text-blue-500" />;
  if (item.type === 'scheduled') return <Zap className="w-4 h-4 text-amber-500" />;
  const Icon = AGENT_ICONS[item.label.toLowerCase().replace(' agent ran', '_agent')] ?? Zap;
  return <Icon className="w-4 h-4 text-gray-500" />;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    complete:  'bg-green-100 text-green-700',
    error:     'bg-red-100 text-red-700',
    failed:    'bg-red-100 text-red-700',
    running:   'bg-blue-100 text-blue-700',
    pending:   'bg-gray-100 text-gray-500',
    posted:    'bg-green-100 text-green-700',
    scheduled: 'bg-blue-100 text-blue-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-500';
}

export default function ActivityLogTab({ clientId }: { clientId: string }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const [
      { data: jobs },
      { data: scheduled },
      { data: posts },
      { data: notes },
    ] = await Promise.all([
      supabase.from('jobs').select('*').eq('client_id', clientId).order('started_at', { ascending: false }).limit(50),
      supabase.from('scheduled_jobs').select('*').eq('client_id', clientId).order('run_at', { ascending: false }).limit(30),
      supabase.from('gbp_posts').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
      supabase.from('client_notes').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(30),
    ]);

    const items: FeedItem[] = [];

    for (const j of (jobs ?? []) as Job[]) {
      items.push({
        id: `job-${j.id}`,
        type: 'job',
        timestamp: j.started_at ?? j.completed_at ?? '',
        label: `${AGENT_LABELS[j.agent_name] ?? j.agent_name} agent ran`,
        status: j.status,
      });
    }
    for (const s of (scheduled ?? []) as ScheduledJob[]) {
      items.push({
        id: `sched-${s.id}`,
        type: 'scheduled',
        timestamp: s.run_at,
        label: s.job_type,
        status: s.status,
      });
    }
    for (const p of (posts ?? []) as GbpPost[]) {
      if (p.status === 'posted') {
        items.push({
          id: `post-${p.id}`,
          type: 'gbp_post',
          timestamp: p.scheduled_date ?? p.created_at,
          label: 'GBP post published',
          detail: p.content.slice(0, 80) + (p.content.length > 80 ? '…' : ''),
          status: 'posted',
        });
      }
    }
    for (const n of (notes ?? []) as ClientNote[]) {
      items.push({
        id: `note-${n.id}`,
        type: 'note',
        timestamp: n.created_at,
        label: 'Note added',
        detail: n.note,
      });
    }

    items.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
    setFeed(items);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    await supabase.from('client_notes').insert({ client_id: clientId, note: note.trim() });
    setNote('');
    setSaving(false);
    load();
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-6 space-y-5">
      {/* Add note */}
      <form onSubmit={addNote} className="flex gap-2">
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a manual note…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
        />
        <button
          type="submit"
          disabled={saving || !note.trim()}
          className="flex items-center gap-1.5 bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#243460] transition-colors disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" /> Add
        </button>
      </form>

      {/* Feed */}
      <div className="relative">
        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-100" />
        <div className="space-y-1">
          {feed.map(item => (
            <div key={item.id} className="flex gap-3 items-start py-2">
              <div className="relative z-10 w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <ItemIcon item={item} />
              </div>
              <div className="flex-1 min-w-0 pt-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  {item.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(item.status)}`}>
                      {item.status}
                    </span>
                  )}
                </div>
                {item.detail && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.detail}</p>}
                {item.timestamp && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(parseISO(item.timestamp), 'd MMM yyyy, h:mm a')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {feed.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No activity yet.</p>
      )}
    </div>
  );
}

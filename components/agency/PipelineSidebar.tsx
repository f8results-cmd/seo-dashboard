'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, RefreshCw, ChevronDown, ChevronRight, Loader2, X, RotateCcw, PanelRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO, formatDistanceStrict } from 'date-fns';
import type { Client, Job } from '@/lib/types';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

const AGENT_LABELS: Record<string, string> = {
  category_research_agent: 'Category Research',
  research_agent:          'Research',
  content_agent:           'Content',
  design_agent:            'Design',
  suburb_agent:            'Suburb Pages',
  deploy_agent:            'Deploy',
  gbp_agent:               'GBP',
  review_request_agent:    'Review Templates',
  citation_agent:          'Citations',
  backlinks_agent:         'Backlinks',
  report_agent:            'Report',
};

// ── Job row ──────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const duration = job.started_at && job.completed_at
    ? formatDistanceStrict(parseISO(job.completed_at), parseISO(job.started_at))
    : null;

  const statusStyle: Record<string, string> = {
    complete:  'bg-green-100 text-green-700',
    error:     'bg-red-100 text-red-700',
    running:   'bg-blue-100 text-blue-700',
    pending:   'bg-gray-100 text-gray-500',
    cancelled: 'bg-orange-100 text-orange-600',
    skipped:   'bg-gray-100 text-gray-400',
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusStyle[job.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {job.status}
        </span>
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">
          {AGENT_LABELS[job.agent_name] ?? job.agent_name}
        </span>
        {duration && <span className="text-xs text-gray-400 flex-shrink-0">{duration}</span>}
        {open
          ? <ChevronDown className="w-3 h-3 text-gray-300 flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
        }
      </button>
      {open && job.log && (
        <div className="border-t border-gray-100 px-2.5 py-2 bg-gray-50">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono overflow-x-auto max-h-40">{job.log}</pre>
        </div>
      )}
    </div>
  );
}

// ── Sidebar content (shared between desktop and mobile drawer) ───────────────

function SidebarContent({ client }: { client: Client }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('client_id', client.id)
      .not('agent_name', 'eq', '_pipeline_failure')
      .order('started_at', { ascending: false })
      .limit(40);
    setJobs((data ?? []) as Job[]);
    setLoading(false);
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  // Subscribe to real-time job changes for this client instead of polling
  useEffect(() => {
    const channel = supabase
      .channel(`jobs-${client.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: `client_id=eq.${client.id}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client.id, load]);

  const lastFailed = jobs.find(j => j.status === 'error');

  async function runPipeline() {
    setRunning(true); setMsg('');
    try {
      const res = await fetch(`${RAILWAY_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id }),
      });
      const json = await res.json();
      setMsg(json.message ?? 'Pipeline triggered.');
    } catch { setMsg('Could not connect to backend.'); }
    setRunning(false);
    setTimeout(load, 3000);
  }

  async function retryFailed() {
    if (!lastFailed) return;
    setRunning(true); setMsg('');
    try {
      const res = await fetch(`${RAILWAY_URL}/retry/${lastFailed.id}`, { method: 'POST' });
      const json = await res.json();
      setMsg(json.message ?? 'Retry triggered.');
    } catch { setMsg('Could not connect to backend.'); }
    setRunning(false);
    setTimeout(load, 3000);
  }

  async function cancelPipeline() {
    setConfirmCancel(false);
    setRunning(true); setMsg('');
    try {
      const res = await fetch(`${RAILWAY_URL}/cancel/${client.id}`, { method: 'POST' });
      const json = await res.json();
      setMsg(`Cancelled. ${json.jobs_cancelled ?? 0} job(s) stopped.`);
    } catch { setMsg('Could not connect to backend.'); }
    setRunning(false);
    setTimeout(load, 2000);
  }

  async function resetClient() {
    setConfirmReset(false);
    setRunning(true); setMsg('');
    try {
      const res = await fetch(`${RAILWAY_URL}/reset/${client.id}`, { method: 'POST' });
      const json = await res.json();
      setMsg(json.status === 'reset' ? 'Reset — ready for fresh run.' : 'Reset failed.');
    } catch { setMsg('Could not connect to backend.'); }
    setRunning(false);
    setTimeout(load, 2000);
  }

  if (loading) {
    return (
      <div className="p-3 space-y-3 animate-pulse">
        <div className="h-9 bg-gray-200 rounded-lg" />
        <div className="space-y-1.5">
          {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-gray-200 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Running indicator */}
      {hasRunning && (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1.5 rounded-lg">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          Running — auto-refreshing
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-1.5">
        <button
          onClick={runPipeline}
          disabled={running}
          className="w-full flex items-center justify-center gap-2 bg-[#E8622A] text-white px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-[#d05520] transition-colors disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run Full Pipeline
        </button>

        {lastFailed && (
          <button
            onClick={retryFailed}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Last Failed
          </button>
        )}

        {hasRunning && !confirmCancel && (
          <button
            onClick={() => setConfirmCancel(true)}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" /> Cancel Pipeline
          </button>
        )}
        {confirmCancel && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs">
            <p className="text-red-700 mb-1.5">Stop the current run?</p>
            <div className="flex gap-3">
              <button onClick={cancelPipeline} className="font-medium text-red-600 hover:text-red-800">Yes, cancel</button>
              <button onClick={() => setConfirmCancel(false)} className="text-gray-500">No</button>
            </div>
          </div>
        )}

        {!confirmReset && (
          <button
            onClick={() => setConfirmReset(true)}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 text-gray-400 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" /> Reset Client
          </button>
        )}
        {confirmReset && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
            <p className="text-amber-700 mb-1.5">Reset live_url and github_repo?</p>
            <div className="flex gap-3">
              <button onClick={resetClient} className="font-medium text-amber-700 hover:text-amber-900">Yes, reset</button>
              <button onClick={() => setConfirmReset(false)} className="text-gray-500">No</button>
            </div>
          </div>
        )}

        {msg && <p className="text-xs text-gray-500">{msg}</p>}
      </div>

      <hr className="border-gray-100" />

      {/* Agent History */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent History</h3>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 p-0.5" title="Refresh">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-xs text-gray-400">No jobs run yet.</p>
        ) : (
          <div className="space-y-1">
            {jobs.map(job => <JobRow key={job.id} job={job} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────────────

interface Props {
  client: Client;
}

export default function PipelineSidebar({ client }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Desktop sticky sidebar */}
      <aside
        className="hidden lg:block flex-shrink-0 self-start sticky top-6"
        style={{ width: '300px' }}
      >
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <PanelRight className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Pipeline</h2>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 56px)' }}>
            <SidebarContent client={client} />
          </div>
        </div>
      </aside>

      {/* Mobile floating button — bottom-right */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 bg-[#E8622A] text-white px-4 py-3 rounded-full shadow-lg text-sm font-medium hover:bg-[#d05520] transition-colors"
        >
          <PanelRight className="w-4 h-4" /> Pipeline
        </button>
      </div>

      {/* Mobile bottom drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <PanelRight className="w-4 h-4 text-gray-400" /> Pipeline
              </h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <SidebarContent client={client} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

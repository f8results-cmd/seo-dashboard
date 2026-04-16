'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, RefreshCw, ChevronDown, ChevronRight, Loader2, X, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO, formatDistanceStrict } from 'date-fns';
import type { Client, Job } from '@/lib/types';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

const AGENT_ORDER = [
  'research_agent','content_agent','design_agent','suburb_agent',
  'deploy_agent','gbp_agent','citation_agent','report_agent',
];
const AGENT_LABELS: Record<string, string> = {
  research_agent: 'Research', content_agent: 'Content', design_agent: 'Design',
  deploy_agent: 'Deploy', suburb_agent: 'Suburb Pages', gbp_agent: 'GBP',
  citation_agent: 'Citations', report_agent: 'Report',
};

function JobRow({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const duration = job.started_at && job.completed_at
    ? formatDistanceStrict(parseISO(job.completed_at), parseISO(job.started_at))
    : null;

  const statusStyle: Record<string, string> = {
    complete:   'bg-green-100 text-green-700',
    error:      'bg-red-100 text-red-700',
    running:    'bg-blue-100 text-blue-700',
    pending:    'bg-gray-100 text-gray-500',
    cancelled:  'bg-orange-100 text-orange-600',
    skipped:    'bg-gray-100 text-gray-400',
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusStyle[job.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {job.status}
        </span>
        <span className="text-sm font-medium text-gray-800 flex-1">
          {AGENT_LABELS[job.agent_name] ?? job.agent_name} agent
        </span>
        {duration && <span className="text-xs text-gray-400">{duration}</span>}
        <span className="text-xs text-gray-400">
          {job.started_at ? format(parseISO(job.started_at), 'd MMM, h:mm a') : ''}
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-300" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
      </button>
      {open && job.log && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono overflow-x-auto max-h-64">{job.log}</pre>
        </div>
      )}
    </div>
  );
}

export default function PipelineTab({ client }: { client: Client }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});
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
      .limit(30);
    setJobs((data ?? []) as Job[]);
    setLoading(false);
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  const lastFailed = jobs.find(j => j.status === 'error');
  const hasRunning = jobs.some(j => j.status === 'running');

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
    } catch { setMsg('Could not connect to Railway backend.'); }
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
    } catch { setMsg('Could not connect to Railway backend.'); }
    setRunning(false);
    setTimeout(load, 3000);
  }

  async function cancelPipeline() {
    setConfirmCancel(false);
    setRunning(true); setMsg('');
    try {
      const res = await fetch(`${RAILWAY_URL}/cancel/${client.id}`, { method: 'POST' });
      const json = await res.json();
      setMsg(`Pipeline cancelled. ${json.jobs_cancelled ?? 0} job(s) stopped.`);
    } catch { setMsg('Could not connect to Railway backend.'); }
    setRunning(false);
    setTimeout(load, 2000);
  }

  async function resetClient() {
    setConfirmReset(false);
    setRunning(true); setMsg('');
    try {
      const res = await fetch(`${RAILWAY_URL}/reset/${client.id}`, { method: 'POST' });
      const json = await res.json();
      setMsg(json.status === 'reset' ? 'Client reset. Ready for a fresh pipeline run.' : 'Reset failed.');
    } catch { setMsg('Could not connect to Railway backend.'); }
    setRunning(false);
    setTimeout(load, 2000);
  }

  async function saveField(field: string, value: string) {
    await supabase.from('clients').update({ [field]: value || null }).eq('id', client.id);
    setEditing(e => { const n = { ...e }; delete n[field]; return n; });
  }

  const fields = [
    { label: 'GHL Sub-account ID',  key: 'ghl_location_id',  value: client.ghl_location_id,  masked: false },
    { label: 'GHL Webhook URL',     key: 'ghl_webhook_url',  value: client.ghl_webhook_url,  masked: false },
    { label: 'Live URL',            key: 'live_url',         value: client.live_url,         masked: false },
  ];

  if (loading) return (
    <div className="p-6 space-y-6">
      <div>
        <div className="h-5 bg-gray-200 rounded w-36 mb-3 animate-pulse" />
        <div className="space-y-2 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="h-3 bg-gray-200 rounded w-36" />
              <div className="h-3 bg-gray-200 rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="h-5 bg-gray-200 rounded w-28 mb-3 animate-pulse" />
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="h-5 bg-gray-200 rounded-full w-16" />
              <div className="h-4 bg-gray-200 rounded flex-1" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Connection status */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Connection Status</h3>
        <div className="space-y-2">
          {fields.map(f => (
            <div key={f.key} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <span className="text-xs text-gray-500 w-36 flex-shrink-0">{f.label}</span>
              {editing[f.key] !== undefined ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type={f.masked ? 'password' : 'text'}
                    defaultValue={f.value ?? ''}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveField(f.key, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditing(ed => { const n = {...ed}; delete n[f.key]; return n; }); }}
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#E8622A]"
                  />
                  <button onClick={() => setEditing(ed => { const n = {...ed}; delete n[f.key]; return n; })} className="text-xs text-gray-400">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(ed => ({ ...ed, [f.key]: f.value ?? '' }))}
                  className="flex-1 text-left text-sm text-gray-700 hover:text-[#E8622A] transition-colors"
                >
                  {f.masked && f.value ? '••••••••••••' : (f.value || <span className="text-gray-400 italic">Not set — click to edit</span>)}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={runPipeline}
            disabled={running}
            className="flex items-center gap-2 bg-[#E8622A] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#d05520] transition-colors disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Full Pipeline
          </button>
          {lastFailed && (
            <button
              onClick={retryFailed}
              disabled={running}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> Retry Last Failed
            </button>
          )}
          {hasRunning && !confirmCancel && (
            <button
              onClick={() => setConfirmCancel(true)}
              disabled={running}
              className="flex items-center gap-2 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" /> Cancel Pipeline
            </button>
          )}
          {confirmCancel && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-red-700">Are you sure? This will stop the current pipeline run.</span>
              <button onClick={cancelPipeline} className="text-sm font-medium text-red-600 hover:text-red-800">Yes, cancel</button>
              <button onClick={() => setConfirmCancel(false)} className="text-sm text-gray-500 hover:text-gray-700">No</button>
            </div>
          )}
          {!confirmReset && (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={running}
              className="flex items-center gap-2 border border-gray-200 text-gray-500 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> Reset Client
            </button>
          )}
          {confirmReset && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-amber-700">Reset live_url and github_repo? Pipeline can then run from scratch.</span>
              <button onClick={resetClient} className="text-sm font-medium text-amber-700 hover:text-amber-900">Yes, reset</button>
              <button onClick={() => setConfirmReset(false)} className="text-sm text-gray-500 hover:text-gray-700">No</button>
            </div>
          )}
        </div>
        {msg && <p className="text-sm text-gray-600 mt-2">{msg}</p>}
      </div>

      {/* Job history */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Agent History</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-gray-400">No jobs run yet.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => <JobRow key={job.id} job={job} />)}
          </div>
        )}
      </div>
    </div>
  );
}

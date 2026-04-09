import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import ScoreChart from '@/components/agency/ScoreChart';
import ClientActions from '@/components/agency/ClientActions';
import PipelinePoller from '@/components/agency/PipelinePoller';
import type { Client, Job, Score } from '@/lib/types';

export const dynamic = 'force-dynamic';

// agent_name values as written by Python pipeline.py
const PIPELINE_AGENTS = [
  'research_agent', 'content_agent', 'design_agent', 'deploy_agent',
  'suburb_agent', 'gbp_agent', 'citation_agent', 'report_agent',
];

const AGENT_LABELS: Record<string, string> = {
  research_agent: 'Research',
  content_agent: 'Content',
  design_agent: 'Design',
  deploy_agent: 'Deploy',
  suburb_agent: 'Suburb Pages',
  gbp_agent: 'GBP',
  citation_agent: 'Citations',
  report_agent: 'Report',
};

// Deliverable labels use Python's _output:agent_name convention
const DELIVERABLE_CHECKLIST = [
  { key: '_output:research_agent', label: 'Research complete' },
  { key: '_output:content_agent', label: 'Content generated' },
  { key: '_output:design_agent', label: 'Design generated' },
  { key: '_output:deploy_agent', label: 'Website deployed' },
  { key: '_output:suburb_agent', label: 'Suburb pages built' },
  { key: '_output:gbp_agent', label: 'GBP configured' },
  { key: '_output:citation_agent', label: 'Citations submitted' },
  { key: '_output:report_agent', label: 'Initial report generated' },
];

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: clientData } = await supabase
    .from('clients').select('*').eq('id', params.id).single();

  if (!clientData) notFound();
  const client = clientData as Client;

  const [
    { data: jobs },
    { data: scores },
    { data: deliverables },
  ] = await Promise.all([
    supabase.from('jobs').select('*').eq('client_id', params.id)
      .not('agent_name', 'eq', '_pipeline_failure')
      .order('started_at', { ascending: false }),
    supabase.from('scores').select('*').eq('client_id', params.id)
      .order('recorded_at', { ascending: false }).limit(12),
    supabase.from('deliverables').select('label').eq('client_id', params.id),
  ]);

  const deliverableKeys = new Set((deliverables ?? []).map((d: { label: string }) => d.label));
  const latestScore = (scores as Score[])?.[0];
  const isRunning = client.status === 'running';

  // Latest job per agent
  const latestJobPerAgent: Record<string, Job> = {};
  for (const job of (jobs as Job[]) ?? []) {
    if (!latestJobPerAgent[job.agent_name]) {
      latestJobPerAgent[job.agent_name] = job;
    }
  }

  // Current running agent name (for display during polling)
  const runningAgent = (jobs as Job[] ?? []).find((j) => j.status === 'running');

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/agency/clients" className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900 truncate">{client.business_name}</h1>
              <StatusBadge status={client.status} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {client.niche} · {client.city}, {client.state}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0">
          <ClientActions clientId={client.id} status={client.status} liveUrl={client.live_url} />
        </div>
      </div>

      {/* Pipeline running banner */}
      {isRunning && (
        <div className="mb-6 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </span>
            <div>
              <p className="text-sm font-semibold text-blue-800">Pipeline running</p>
              {runningAgent && (
                <p className="text-xs text-blue-600 mt-0.5">
                  Current agent: <strong>{AGENT_LABELS[runningAgent.agent_name] ?? runningAgent.agent_name}</strong>
                </p>
              )}
            </div>
          </div>
          <PipelinePoller isRunning={isRunning} />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">

          {/* SEO Scores */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">SEO Scores</h2>
              {latestScore && (
                <div className="flex gap-3">
                  <ScoreBadge label="Local" value={latestScore.local_seo_score} />
                  <ScoreBadge label="Onsite" value={latestScore.onsite_seo_score} />
                  <ScoreBadge label="Geo" value={latestScore.geo_score} />
                </div>
              )}
            </div>
            <ScoreChart scores={(scores as Score[]) ?? []} />
          </div>

          {/* Pipeline Status */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Pipeline Status</h2>
            <div className="space-y-2">
              {PIPELINE_AGENTS.map((agentName) => {
                const job = latestJobPerAgent[agentName];
                return (
                  <div key={agentName} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <AgentStatusIcon status={job?.status} />
                      <span className="text-sm font-medium text-gray-800">
                        {AGENT_LABELS[agentName] ?? agentName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {job && (
                        <>
                          <JobStatusBadge status={job.status} />
                          {job.completed_at && (
                            <span className="text-xs text-gray-400">
                              {format(new Date(job.completed_at), 'dd MMM HH:mm')}
                            </span>
                          )}
                        </>
                      )}
                      {!job && <span className="text-xs text-gray-400">Not started</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Error display */}
            {Object.values(latestJobPerAgent).filter((j) => j.status === 'error' && j.log).length > 0 && (
              <div className="mt-4 space-y-2">
                {Object.values(latestJobPerAgent)
                  .filter((j) => j.status === 'error' && j.log)
                  .map((j) => (
                    <div key={j.id} className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-xs">
                      <span className="font-medium text-red-700">{AGENT_LABELS[j.agent_name] ?? j.agent_name}: </span>
                      <span className="text-red-600 line-clamp-3">{j.log}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Job History */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Job History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Agent</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Started</th>
                    <th className="text-left py-2 font-medium text-gray-500">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {((jobs as Job[]) ?? []).slice(0, 20).map((job) => (
                    <tr key={job.id}>
                      <td className="py-2 pr-4 text-gray-800">{AGENT_LABELS[job.agent_name] ?? job.agent_name}</td>
                      <td className="py-2 pr-4"><JobStatusBadge status={job.status} /></td>
                      <td className="py-2 pr-4 text-gray-500 text-xs">
                        {job.started_at ? format(new Date(job.started_at), 'dd MMM HH:mm') : '—'}
                      </td>
                      <td className="py-2 text-gray-500 text-xs">
                        {job.completed_at ? format(new Date(job.completed_at), 'dd MMM HH:mm') : '—'}
                      </td>
                    </tr>
                  ))}
                  {((jobs as Job[]) ?? []).length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-400">No jobs yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Client Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Client Info</h2>
            <dl className="space-y-3">
              <InfoRow label="Owner" value={client.owner_name} />
              <InfoRow label="Email" value={client.email} />
              <InfoRow label="Phone" value={client.phone} />
              <InfoRow label="Address" value={[client.address, client.city, client.state].filter(Boolean).join(', ')} />
              <InfoRow label="Tagline" value={client.tagline} />
              <InfoRow label="Years in Biz" value={client.years_in_business?.toString()} />
              {client.live_url && (
                <div>
                  <dt className="text-xs text-gray-500 mb-0.5">Live URL</dt>
                  <dd>
                    <a href={client.live_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1B2B6B] hover:underline break-all">
                      {client.live_url}
                    </a>
                  </dd>
                </div>
              )}
              {client.gbp_url && (
                <div>
                  <dt className="text-xs text-gray-500 mb-0.5">GBP URL</dt>
                  <dd>
                    <a href={client.gbp_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1B2B6B] hover:underline">
                      Google Business Profile
                    </a>
                  </dd>
                </div>
              )}
              {client.notes && (
                <div>
                  <dt className="text-xs text-gray-500 mb-0.5">Notes</dt>
                  <dd className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Deliverables Checklist */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Deliverables</h2>
            <ul className="space-y-2">
              {DELIVERABLE_CHECKLIST.map(({ key, label }) => (
                <li key={key} className="flex items-center gap-2.5 text-sm">
                  {deliverableKeys.has(key) ? (
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                  <span className={deliverableKeys.has(key) ? 'text-gray-800' : 'text-gray-400'}>{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Branding */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Branding</h2>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1.5">Primary</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-gray-200" style={{ background: client.brand_primary_color ?? '#1B2B6B' }} />
                  <span className="text-xs font-mono text-gray-600">{client.brand_primary_color}</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1.5">Accent</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-gray-200" style={{ background: client.brand_accent_color ?? '#E8622A' }} />
                  <span className="text-xs font-mono text-gray-600">{client.brand_accent_color}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Website Preview */}
          {client.live_url && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Website Preview</h2>
              <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 280 }}>
                <iframe
                  src={client.live_url}
                  className="w-full h-full"
                  title={`${client.business_name} website`}
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
              <a
                href={client.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-xs text-[#1B2B6B] hover:underline flex items-center gap-1"
              >
                Open in new tab
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    running: 'bg-blue-100 text-blue-700',
    complete: 'bg-blue-100 text-blue-700',
    error: 'bg-red-100 text-red-700',
    failed: 'bg-red-200 text-red-800',
    inactive: 'bg-gray-100 text-gray-600',
  };
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    running: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'text-green-600 bg-green-50' : value >= 40 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
  return (
    <div className={`px-3 py-1.5 rounded-lg text-center ${color}`}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  );
}

function AgentStatusIcon({ status }: { status?: string }) {
  if (status === 'complete') return <div className="w-2.5 h-2.5 rounded-full bg-green-500" />;
  if (status === 'error') return <div className="w-2.5 h-2.5 rounded-full bg-red-500" />;
  if (status === 'running') return <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />;
  return <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />;
}

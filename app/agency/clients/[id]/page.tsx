'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ClientDetailTabs from '@/components/agency/ClientDetailTabs';
import EditClientModal from '@/components/agency/EditClientModal';
import PipelinePoller from '@/components/agency/PipelinePoller';
import type { Client, Job, Score, GbpPost, ReviewResponse, RankTracking, HeatmapResult, ScheduledJob, MonthlyReport } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

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

interface PageData {
  client: Client;
  jobs: Job[];
  scores: Score[];
  deliverables: { label: string }[];
  gbpPosts: GbpPost[];
  reviews: ReviewResponse[];
  rankings: RankTracking[];
  heatmapResult: HeatmapResult | null;
  scheduledJobs: ScheduledJob[];
  monthlyReports: MonthlyReport[];
}

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [pipelineMsg, setPipelineMsg] = useState('');
  const [pipelineLoading, setPipelineLoading] = useState(false);

  async function fetchData() {
    const supabase = createClient();
    const [
      { data: clientData },
      { data: jobs },
      { data: scores },
      { data: deliverables },
      { data: gbpPosts },
      { data: reviews },
      { data: rankings },
      { data: heatmapRows },
      { data: scheduledJobs },
      { data: monthlyReports },
    ] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('jobs').select('*').eq('client_id', id)
        .not('agent_name', 'eq', '_pipeline_failure')
        .order('started_at', { ascending: false }),
      supabase.from('scores').select('*').eq('client_id', id)
        .order('recorded_at', { ascending: false }).limit(12),
      supabase.from('deliverables').select('label').eq('client_id', id),
      supabase.from('gbp_posts').select('*').eq('client_id', id)
        .order('scheduled_date', { ascending: false }).limit(30),
      supabase.from('review_responses').select('*').eq('client_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('rank_tracking').select('*').eq('client_id', id)
        .order('checked_at', { ascending: false }),
      supabase.from('heatmap_results').select('*').eq('client_id', id)
        .order('scan_date', { ascending: false }).limit(1),
      supabase.from('scheduled_jobs').select('*').eq('client_id', id)
        .order('run_at', { ascending: false }).limit(100),
      supabase.from('monthly_reports').select('*').eq('client_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (clientData) {
      setData({
        client: clientData as Client,
        jobs: (jobs as Job[]) ?? [],
        scores: (scores as Score[]) ?? [],
        deliverables: (deliverables as { label: string }[]) ?? [],
        gbpPosts: (gbpPosts as GbpPost[]) ?? [],
        reviews: (reviews as ReviewResponse[]) ?? [],
        rankings: (rankings as RankTracking[]) ?? [],
        heatmapResult: (heatmapRows as HeatmapResult[] | null)?.[0] ?? null,
        scheduledJobs: (scheduledJobs as ScheduledJob[]) ?? [],
        monthlyReports: (monthlyReports as MonthlyReport[]) ?? [],
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // Revalidate every 30 seconds
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [id]);

  // Refresh data after edit modal closes
  function handleEditClose() {
    setEditOpen(false);
    fetchData();
  }

  async function triggerPipeline() {
    setPipelineLoading(true);
    setPipelineMsg('');
    const url = process.env.NEXT_PUBLIC_RAILWAY_URL;
    if (!url) {
      setPipelineMsg('NEXT_PUBLIC_RAILWAY_URL not configured');
      setPipelineLoading(false);
      return;
    }
    try {
      const res = await fetch(`${url}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: id }),
      });
      setPipelineMsg(res.ok ? 'Pipeline triggered!' : 'Trigger failed');
      if (res.ok) setTimeout(fetchData, 2000);
    } catch {
      setPipelineMsg('Failed to reach Railway server');
    }
    setPipelineLoading(false);
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-pulse">
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-2">
            <div className="h-7 w-64 bg-gray-200 rounded-lg" />
            <div className="h-4 w-40 bg-gray-100 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-gray-200 rounded-lg" />
            <div className="h-9 w-32 bg-gray-200 rounded-lg" />
          </div>
        </div>
        <div className="h-12 w-full bg-gray-100 rounded-xl mb-6" />
        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            <div className="h-64 bg-gray-100 rounded-xl" />
            <div className="h-48 bg-gray-100 rounded-xl" />
          </div>
          <div className="w-72 space-y-4">
            <div className="h-48 bg-gray-100 rounded-xl" />
            <div className="h-48 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const { client, jobs, scores, deliverables, gbpPosts, reviews, rankings, heatmapResult } = data;
  const latestScore = scores[0];
  const healthScore = latestScore
    ? Math.round((latestScore.local_seo_score + latestScore.onsite_seo_score + latestScore.geo_score) / 3)
    : null;

  const isRunning = client.status === 'running';
  const runningAgent = jobs.find((j) => j.status === 'running');

  const latestJobPerAgent: Record<string, Job> = {};
  for (const job of jobs) {
    if (!latestJobPerAgent[job.agent_name]) {
      latestJobPerAgent[job.agent_name] = job;
    }
  }

  const deliverableKeys = deliverables.map((d) => d.label);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
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
              {healthScore !== null && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                  healthScore >= 70 ? 'bg-green-100 text-green-700'
                  : healthScore >= 40 ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
                }`}>
                  <span className="text-xs font-medium opacity-70">Health</span>
                  {healthScore}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {[client.niche, client.city && client.state ? `${client.city}, ${client.state}` : client.city ?? client.state].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 flex-shrink-0">
          {/* Edit button */}
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Edit
          </button>

          {/* Run Pipeline */}
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={triggerPipeline}
              disabled={pipelineLoading || isRunning}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-navy-500 text-white text-sm font-medium rounded-lg hover:bg-navy-600 disabled:opacity-60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
              {pipelineLoading ? 'Triggering...' : isRunning ? 'Running...' : 'Run Pipeline'}
            </button>
            {pipelineMsg && <p className="text-xs text-gray-500">{pipelineMsg}</p>}
          </div>
        </div>
      </div>

      {/* ── Pipeline running banner ───────────────────────────────────────── */}
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

      {/* ── Tabs + Sidebar ────────────────────────────────────────────────── */}
      <ClientDetailTabs
        client={client}
        jobs={jobs}
        scores={scores}
        deliverableKeys={deliverableKeys}
        gbpPosts={gbpPosts}
        reviews={reviews}
        rankings={rankings}
        latestJobPerAgent={latestJobPerAgent}
        heatmapResult={heatmapResult}
        scheduledJobs={data.scheduledJobs}
        monthlyReports={data.monthlyReports}
      />

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      {editOpen && (
        <EditClientModal
          client={client}
          onClose={handleEditClose}
        />
      )}
    </div>
  );
}

// ── Badge Components ──────────────────────────────────────────────────────────

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
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

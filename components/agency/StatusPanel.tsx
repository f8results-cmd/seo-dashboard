'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, Globe, Tag, AlignLeft, MapPin, Clock, FileText, Star, MessageSquare, Bell, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import type { Client } from '@/lib/types';

interface StatusData {
  live_url: string | null;
  has_categories: boolean;
  description_chars: number;
  manual_services_chars: number;
  suburb_count: number;
  last_pipeline_run: string | null;
  last_pipeline_status: string | null;
  gbp_posts_published_month: number;
  gbp_posts_queued: number;
  review_rating: number | null;
  review_count: number | null;
  review_responses_month: number;
  friday_updates_month: number;
  friday_update_needed: boolean;
  pending_approvals: number;
  overdue_rollout_items: number;
  seo_score: number | null;
  seo_score_date: string | null;
}

function Row({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: React.ReactNode; ok?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="flex-shrink-0 mt-0.5 text-gray-400">{icon}</span>
      <span className="text-xs text-gray-500 w-36 flex-shrink-0">{label}</span>
      <span className={`text-xs font-medium flex-1 ${ok === true ? 'text-green-700' : ok === false ? 'text-red-600' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

export default function StatusPanel({ client }: { client: Client }) {
  const [data, setData] = useState<StatusData | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const clientId = client.id;
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
    const weekStart = (() => {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + 1); // Monday
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    })();
    const today = now.toISOString().split('T')[0];

    const [
      jobRes,
      gbpPublishedRes,
      gbpQueuedRes,
      reviewRespRes,
      fridayMonthRes,
      fridayWeekRes,
      pendingApprovalRes,
      overdueRes,
    ] = await Promise.all([
      supabase.from('jobs').select('started_at, status')
        .eq('client_id', clientId)
        .not('agent_name', 'eq', '_pipeline_failure')
        .order('started_at', { ascending: false }).limit(1),
      supabase.from('gbp_posts').select('id', { count: 'exact', head: true })
        .eq('client_id', clientId).eq('status', 'posted').gte('created_at', monthAgo),
      supabase.from('approval_queue').select('id', { count: 'exact', head: true })
        .eq('client_id', clientId).eq('action_type', 'gbp_post').eq('status', 'pending'),
      supabase.from('review_responses').select('id', { count: 'exact', head: true })
        .eq('client_id', clientId).gte('created_at', monthAgo),
      supabase.from('friday_updates').select('id', { count: 'exact', head: true })
        .eq('client_id', clientId).not('sent_at', 'is', null).gte('sent_at', monthAgo),
      supabase.from('friday_updates').select('id')
        .eq('client_id', clientId).not('sent_at', 'is', null).gte('sent_at', weekStart).limit(1),
      supabase.from('approval_queue').select('id', { count: 'exact', head: true })
        .eq('client_id', clientId).eq('status', 'pending'),
      supabase.from('client_rollout_weeks').select('id', { count: 'exact', head: true })
        .eq('client_id', clientId).lt('ends_on', today).eq('completed', false),
    ]);

    const wd = (client.website_data ?? {}) as Record<string, unknown>;
    setData({
      live_url: client.live_url ?? client.website_url ?? null,
      has_categories: Boolean(client.gbp_primary_category),
      description_chars: ((wd['gbp_description'] as string) ?? '').length,
      manual_services_chars: (client.manual_services ?? '').length,
      suburb_count: (client.target_suburbs ?? []).length,
      last_pipeline_run: jobRes.data?.[0]?.started_at ?? null,
      last_pipeline_status: jobRes.data?.[0]?.status ?? null,
      gbp_posts_published_month: gbpPublishedRes.count ?? 0,
      gbp_posts_queued: gbpQueuedRes.count ?? 0,
      review_rating: client.review_rating ?? null,
      review_count: client.review_count ?? null,
      review_responses_month: reviewRespRes.count ?? 0,
      friday_updates_month: fridayMonthRes.count ?? 0,
      friday_update_needed: (fridayWeekRes.data ?? []).length === 0,
      pending_approvals: pendingApprovalRes.count ?? 0,
      overdue_rollout_items: overdueRes.count ?? 0,
      seo_score: null,
      seo_score_date: null,
    });

    // SEO score separately (different table)
    const { data: scoreData } = await supabase.from('seo_health_scores')
      .select('score_total, scored_at').eq('client_id', clientId)
      .order('scored_at', { ascending: false }).limit(1);
    if (scoreData?.[0]) {
      setData(prev => prev ? {
        ...prev,
        seo_score: scoreData[0].score_total,
        seo_score_date: (scoreData[0].scored_at ?? '').slice(0, 10),
      } : prev);
    }
  }, [client.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-28 mb-3" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-3 bg-gray-100 rounded w-full" />)}
        </div>
      </div>
    );
  }

  const setupOk = data.has_categories && data.suburb_count > 0 && !!data.live_url;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-sm">
      {/* Current status */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Status</h3>
      </div>
      <div className="px-4 py-2 divide-y divide-gray-50">
        <Row
          icon={<Globe className="w-3.5 h-3.5" />}
          label="Live website"
          value={data.live_url
            ? <a href={data.live_url} target="_blank" rel="noopener noreferrer" className="text-[#E8622A] hover:underline truncate block max-w-[160px]">{data.live_url.replace(/^https?:\/\//, '')}</a>
            : <span className="text-gray-400">not deployed</span>}
          ok={!!data.live_url}
        />
        <Row
          icon={<Tag className="w-3.5 h-3.5" />}
          label="GBP categories"
          value={data.has_categories
            ? <span className="text-green-700">Set — {String(client.gbp_primary_category ?? '')}</span>
            : <span className="text-red-500">not set</span>}
          ok={data.has_categories}
        />
        <Row
          icon={<AlignLeft className="w-3.5 h-3.5" />}
          label="Manual services"
          value={data.manual_services_chars > 0
            ? `${data.manual_services_chars} chars`
            : <span className="text-gray-400">not set</span>}
          ok={data.manual_services_chars > 50}
        />
        <Row
          icon={<MapPin className="w-3.5 h-3.5" />}
          label="Target suburbs"
          value={data.suburb_count > 0
            ? `${data.suburb_count} suburb${data.suburb_count !== 1 ? 's' : ''}`
            : <span className="text-gray-400">not set</span>}
          ok={data.suburb_count > 0}
        />
        <Row
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Last pipeline run"
          value={data.last_pipeline_run
            ? <span>{format(parseISO(data.last_pipeline_run), 'd MMM yyyy')} <span className={`text-xs ${data.last_pipeline_status === 'complete' ? 'text-green-600' : 'text-red-500'}`}>({data.last_pipeline_status})</span></span>
            : <span className="text-gray-400">never</span>}
        />
      </div>

      {/* This month's activity */}
      <div className="px-4 py-3 border-t border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">This Month</h3>
      </div>
      <div className="px-4 py-2 divide-y divide-gray-50">
        <Row
          icon={<FileText className="w-3.5 h-3.5" />}
          label="GBP posts published"
          value={data.gbp_posts_published_month > 0
            ? `${data.gbp_posts_published_month} published`
            : <span className="text-gray-400">—</span>}
        />
        <Row
          icon={<FileText className="w-3.5 h-3.5" />}
          label="GBP posts queued"
          value={data.gbp_posts_queued > 0
            ? <Link href={`/agency/approvals?client=${client.id}`} className="text-amber-600 hover:underline">{data.gbp_posts_queued} awaiting approval</Link>
            : <span className="text-gray-400">none pending</span>}
        />
        <Row
          icon={<Star className="w-3.5 h-3.5" />}
          label="Avg rating"
          value={data.review_rating != null
            ? `${data.review_rating.toFixed(1)} ★ (${data.review_count ?? 0} reviews)`
            : <span className="text-gray-400">—</span>}
        />
        <Row
          icon={<MessageSquare className="w-3.5 h-3.5" />}
          label="Review responses"
          value={data.review_responses_month > 0
            ? `${data.review_responses_month} drafted`
            : <span className="text-gray-400">—</span>}
        />
        <Row
          icon={<Bell className="w-3.5 h-3.5" />}
          label="Friday updates"
          value={data.friday_updates_month > 0
            ? `${data.friday_updates_month} sent`
            : <span className="text-gray-400">—</span>}
        />
        {data.seo_score != null && (
          <Row
            icon={<CheckCircle className="w-3.5 h-3.5" />}
            label="SEO health score"
            value={`${data.seo_score}/100${data.seo_score_date ? ` (${data.seo_score_date})` : ''}`}
            ok={data.seo_score >= 60}
          />
        )}
      </div>

      {/* Action needed */}
      {(data.pending_approvals > 0 || data.overdue_rollout_items > 0 || data.friday_update_needed) && (
        <>
          <div className="px-4 py-3 border-t border-b border-gray-100 bg-amber-50">
            <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Awaiting Your Action</h3>
          </div>
          <div className="px-4 py-2 divide-y divide-gray-50">
            {data.pending_approvals > 0 && (
              <Row
                icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                label="Pending approvals"
                value={<Link href={`/agency/approvals`} className="text-amber-600 hover:underline">{data.pending_approvals} item{data.pending_approvals !== 1 ? 's' : ''} to review</Link>}
              />
            )}
            {data.overdue_rollout_items > 0 && (
              <Row
                icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                label="Overdue tasks"
                value={<span className="text-red-600">{data.overdue_rollout_items} overdue</span>}
              />
            )}
            {data.friday_update_needed && (
              <Row
                icon={<Bell className="w-3.5 h-3.5 text-purple-500" />}
                label="Friday update"
                value={<Link href={`/agency/clients/${client.id}?tab=friday`} className="text-purple-600 hover:underline">Due this week</Link>}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

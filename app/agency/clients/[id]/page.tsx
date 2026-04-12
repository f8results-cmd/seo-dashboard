'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, RefreshCw, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calcHealthScore, calcOnboardingPct } from '@/lib/health';
import ClientDetailTabs from '@/components/agency/ClientDetailTabs';
import OnboardingChecklist from '@/components/agency/OnboardingChecklist';
import HealthScore from '@/components/agency/HealthScore';
import type { Client, Deliverable } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-700',
  running:  'bg-blue-100 text-blue-700',
  error:    'bg-red-100 text-red-700',
  failed:   'bg-red-100 text-red-700',
  complete: 'bg-gray-100 text-gray-600',
  inactive: 'bg-gray-100 text-gray-400',
};

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [client, setClient] = useState<Client | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [gbpPostCount, setGbpPostCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const load = useCallback(async () => {
    const [{ data: c }, { data: del }, { count }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('deliverables').select('label, status').eq('client_id', id),
      supabase.from('gbp_posts').select('id', { count: 'exact', head: true }).eq('client_id', id),
    ]);
    if (c) setClient(c as Client);
    setDeliverables((del ?? []) as Deliverable[]);
    setGbpPostCount(count ?? 0);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
        {/* Header card skeleton */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 space-y-2">
              <div className="h-7 bg-gray-200 rounded w-64" />
              <div className="flex gap-2">
                <div className="h-5 bg-gray-200 rounded-full w-20" />
                <div className="h-5 bg-gray-200 rounded w-28" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-gray-200" />
              <div className="space-y-2 min-w-[140px]">
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-2 bg-gray-200 rounded-full w-full" />
                <div className="h-3 bg-gray-200 rounded w-1/2 ml-auto" />
              </div>
            </div>
          </div>
        </div>
        {/* Two-column skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i}>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
            <div className="flex border-b border-gray-200 bg-gray-50 gap-1 p-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded w-20 flex-shrink-0" />
              ))}
            </div>
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Client not found.</p>
        <Link href="/agency/clients" className="text-[#E8622A] text-sm mt-2 inline-block">← Back to clients</Link>
      </div>
    );
  }

  const healthScore = calcHealthScore(client, deliverables, gbpPostCount);
  const { pct: onboardPct, complete: onboardComplete, total: onboardTotal } = calcOnboardingPct(client, deliverables, gbpPostCount);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Back nav */}
      <Link href="/agency/clients" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> All clients
      </Link>

      {/* Top header — always visible */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Business info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{client.business_name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[client.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {client.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
              {client.niche && (
                <span className="bg-[#1a2744] text-white text-xs px-2.5 py-1 rounded-full">{client.niche}</span>
              )}
              {client.city && <span>{client.city}{client.state ? `, ${client.state}` : ''}</span>}
              {client.live_url && (
                <a href={client.live_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#E8622A] hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> Live site
                </a>
              )}
            </div>
          </div>

          {/* Edit button */}
          <Link
            href={`/agency/clients/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>

          {/* Health + onboarding */}
          <div className="flex items-center gap-6">
            <HealthScore score={healthScore} size={60} />
            <div className="min-w-[140px]">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Onboarding</span>
                <span>{onboardComplete}/{onboardTotal}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${onboardPct}%`, backgroundColor: onboardPct === 100 ? '#22c55e' : '#E8622A' }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1 text-right">{onboardPct}% complete</p>
            </div>
            <button onClick={load} className="text-gray-400 hover:text-gray-600 p-1" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Two-column layout: checklist + tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <OnboardingChecklist
          client={client}
          deliverables={deliverables}
          gbpPostCount={gbpPostCount}
          onUpdate={load}
        />
        <ClientDetailTabs client={client} onRefresh={load} />
      </div>
    </div>
  );
}

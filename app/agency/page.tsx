'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import type { Client, ClientStatus } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'active' | 'pending' | 'error';

interface LastRun {
  date: string;
  status: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgencyOverviewPage() {
  const [clients,    setClients]    = useState<Client[]>([]);
  const [lastRunMap, setLastRunMap] = useState<Record<string, LastRun>>({});
  const [filter,     setFilter]     = useState<FilterStatus>('all');
  const [loading,    setLoading]    = useState(true);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [runMsg,     setRunMsg]     = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const supabase = createClient();
    const [{ data: clientRows }, { data: jobRows }] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase
        .from('jobs')
        .select('client_id, started_at, status')
        .not('agent_name', 'eq', '_pipeline_failure')
        .order('started_at', { ascending: false })
        .limit(2000),
    ]);

    setClients((clientRows as Client[]) ?? []);

    // Build last-run lookup (first occurrence per client = most recent)
    const map: Record<string, LastRun> = {};
    for (const job of jobRows ?? []) {
      if (!map[job.client_id] && job.started_at) {
        map[job.client_id] = { date: job.started_at, status: job.status };
      }
    }
    setLastRunMap(map);
    setLoading(false);
  }

  async function triggerPipeline(clientId: string) {
    setRunningIds((s) => new Set(s).add(clientId));
    setRunMsg((m) => ({ ...m, [clientId]: '' }));
    const url = process.env.NEXT_PUBLIC_RAILWAY_URL;
    if (!url) {
      setRunMsg((m) => ({ ...m, [clientId]: 'RAILWAY_URL not set' }));
      setRunningIds((s) => { const n = new Set(s); n.delete(clientId); return n; });
      return;
    }
    try {
      const res = await fetch(`${url}/run`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: clientId }),
      });
      setRunMsg((m) => ({ ...m, [clientId]: res.ok ? 'Triggered!' : 'Failed' }));
      if (res.ok) setTimeout(fetchData, 2000);
    } catch {
      setRunMsg((m) => ({ ...m, [clientId]: 'Unreachable' }));
    } finally {
      setRunningIds((s) => { const n = new Set(s); n.delete(clientId); return n; });
    }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const active   = clients.filter((c) => c.status === 'active').length;
  const pending  = clients.filter((c) => c.status === 'pending').length;
  const errors   = clients.filter((c) => c.status === 'error' || c.status === 'failed').length;
  const live     = clients.filter((c) => !!c.live_url).length;

  // ── Filtered list ──────────────────────────────────────────────────────────
  const displayed = clients.filter((c) => {
    if (filter === 'all')    return true;
    if (filter === 'active') return c.status === 'active';
    if (filter === 'pending') return c.status === 'pending';
    if (filter === 'error')  return c.status === 'error' || c.status === 'failed' || c.status === 'running';
    return true;
  });

  const FILTER_TABS: { id: FilterStatus; label: string; count: number }[] = [
    { id: 'all',     label: 'All',     count: clients.length },
    { id: 'active',  label: 'Active',  count: active },
    { id: 'pending', label: 'Pending', count: pending },
    { id: 'error',   label: 'Error',   count: errors },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agency Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
        </div>
        <Link
          href="/agency/clients/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#E8622A] text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Client
        </Link>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clients"   value={clients.length} color="bg-[#1B2B6B]" />
        <StatCard label="Active"          value={active}         color="bg-green-600" />
        <StatCard label="Websites Live"   value={live}           color="bg-emerald-500" />
        <StatCard label="Errors / Running" value={errors}        color="bg-[#E8622A]" />
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              filter === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${filter === tab.id ? 'text-gray-500' : 'text-gray-400'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Client table ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading clients…</div>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">No clients match this filter</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500">Business</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Niche</th>
                  <th className="px-4 py-3 font-medium text-gray-500">City</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-center">GHL</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-center">WP</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Last Run</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map((client) => {
                  const lastRun   = lastRunMap[client.id];
                  const isRunning = runningIds.has(client.id) || client.status === 'running';
                  const msg       = runMsg[client.id];
                  return (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      {/* Business name */}
                      <td className="px-5 py-3">
                        <Link
                          href={`/agency/clients/${client.id}`}
                          className="font-medium text-gray-900 hover:text-[#1B2B6B] transition-colors"
                        >
                          {client.business_name}
                        </Link>
                      </td>

                      {/* Niche */}
                      <td className="px-4 py-3 text-gray-500 capitalize">
                        {client.niche ?? '—'}
                      </td>

                      {/* City */}
                      <td className="px-4 py-3 text-gray-500">
                        {[client.city, client.state].filter(Boolean).join(', ') || '—'}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <StatusBadge status={client.status} />
                      </td>

                      {/* GHL dot */}
                      <td className="px-4 py-3 text-center">
                        <ConnDot set={!!client.ghl_location_id} title={client.ghl_location_id ?? 'Not set'} />
                      </td>

                      {/* WP dot */}
                      <td className="px-4 py-3 text-center">
                        <ConnDot set={!!client.wp_url} title={client.wp_url ?? 'Not set'} />
                      </td>

                      {/* Last pipeline run */}
                      <td className="px-4 py-3">
                        {lastRun ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              lastRun.status === 'complete' ? 'bg-green-500'
                              : lastRun.status === 'error'  ? 'bg-red-500'
                              : lastRun.status === 'running' ? 'bg-blue-500 animate-pulse'
                              : 'bg-gray-300'
                            }`} />
                            <span className="text-xs text-gray-500">
                              {format(parseISO(lastRun.date), 'dd MMM yyyy')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Never</span>
                        )}
                      </td>

                      {/* Run Pipeline button */}
                      <td className="px-5 py-3 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <button
                            onClick={() => triggerPipeline(client.id)}
                            disabled={isRunning}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B2B6B] text-white text-xs font-medium rounded-lg hover:bg-[#243580] disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {isRunning ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-white/70 animate-pulse" />
                                Running…
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                                </svg>
                                Run Pipeline
                              </>
                            )}
                          </button>
                          {msg && (
                            <span className={`text-xs ${msg === 'Triggered!' ? 'text-green-600' : 'text-red-500'}`}>
                              {msg}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} rounded-xl p-5 text-white`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm opacity-80 mt-1">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ClientStatus | string }) {
  const map: Record<string, string> = {
    active:   'bg-green-100 text-green-700',
    pending:  'bg-yellow-100 text-yellow-700',
    running:  'bg-blue-100 text-blue-700',
    complete: 'bg-blue-100 text-blue-700',
    error:    'bg-red-100 text-red-700',
    failed:   'bg-red-200 text-red-800',
    inactive: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function ConnDot({ set, title }: { set: boolean; title: string }) {
  return (
    <span
      title={title}
      className={`inline-block w-2.5 h-2.5 rounded-full ${set ? 'bg-green-500' : 'bg-red-400'}`}
    />
  );
}

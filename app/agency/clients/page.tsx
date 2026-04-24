'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { healthColour } from '@/lib/health';
import { formatNiche } from '@/lib/utils';
import type { Client, ClientStatus } from '@/lib/types';
import { Plus, Search, Phone, Mail } from 'lucide-react';

const STATUS_OPTIONS: (ClientStatus | 'all')[] = ['all', 'active', 'pending', 'complete', 'inactive', 'error'];

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  pending:  'bg-gray-100 text-gray-500',
  running:  'bg-blue-100 text-blue-700',
  error:    'bg-red-100 text-red-700',
  failed:   'bg-red-100 text-red-700',
  complete: 'bg-blue-100 text-blue-700',
  inactive: 'bg-gray-100 text-gray-400',
};

interface TaskBadge {
  overdue: number;
  today: number;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients]               = useState<Client[]>([]);
  const [clientsWithJobs, setClientsWithJobs] = useState<Set<string>>(new Set());
  const [taskBadges, setTaskBadges]         = useState<Map<string, TaskBadge>>(new Map());
  const [loading, setLoading]               = useState(true);
  const [filter, setFilter]                 = useState<ClientStatus | 'all'>('all');
  const [search, setSearch]                 = useState('');

  useEffect(() => {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    Promise.all([
      supabase.from('clients')
        .select('id, business_name, owner_name, status, health_score, niche, city, state, live_url, phone, email')
        .order('business_name'),
      supabase.from('jobs').select('client_id').not('agent_name', 'eq', '_pipeline_failure').limit(2000),
      supabase.from('client_tasks').select('client_id, due_date').eq('completed', false).lte('due_date', today),
    ]).then(([{ data: clientData }, { data: jobData }, { data: taskData }]) => {
      setClients((clientData as Client[]) ?? []);
      setClientsWithJobs(new Set((jobData ?? []).map((j: { client_id: string }) => j.client_id)));

      const badges = new Map<string, TaskBadge>();
      for (const t of (taskData ?? []) as { client_id: string; due_date: string }[]) {
        if (!t.client_id) continue;
        const b = badges.get(t.client_id) ?? { overdue: 0, today: 0 };
        if (t.due_date === today) b.today++;
        else b.overdue++;
        badges.set(t.client_id, b);
      }
      setTaskBadges(badges);

      setLoading(false);
    });
  }, []);

  const displayed = clients.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.business_name.toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q) ||
        (c.niche ?? '').toLowerCase().includes(q) ||
        (c.owner_name ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts: Record<string, number> = { all: clients.length };
  for (const s of STATUS_OPTIONS.slice(1)) counts[s] = clients.filter(c => c.status === s).length;

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <Link
          href="/agency/onboard"
          className="flex items-center gap-2 bg-[#E8622A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#d05520] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Client
        </Link>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                filter === s
                  ? 'bg-[#1a2744] text-white'
                  : 'border border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
              }`}
            >
              {s} <span className="opacity-60">({counts[s] ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
                <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
              </div>
              <div className="flex gap-2 mb-3">
                <div className="h-5 bg-gray-200 rounded-full w-16" />
                <div className="h-5 bg-gray-200 rounded-full w-20" />
              </div>
              <div className="space-y-1">
                <div className="h-3 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">No clients match.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((client) => {
            const badge = taskBadges.get(client.id);
            return (
              <div
                key={client.id}
                onClick={() => router.push(`/agency/clients/${client.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#E8622A]/40 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-[#E8622A] transition-colors">
                      {client.business_name}
                    </h3>
                    {client.owner_name && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{client.owner_name}</p>
                    )}
                  </div>
                  {/* Health circle */}
                  <span
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: healthColour(client.health_score ?? 0) }}
                  >
                    {client.health_score ?? 0}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {(() => {
                    const displayStatus = clientsWithJobs.has(client.id) ? client.status : 'pending';
                    return (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[displayStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                        {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                      </span>
                    );
                  })()}
                  {client.niche && (
                    <span className="text-xs bg-[#1a2744] text-white px-2.5 py-0.5 rounded-full">{formatNiche(client.niche)}</span>
                  )}
                  {/* Task badges */}
                  {badge && badge.overdue > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-medium">
                      {badge.overdue} overdue
                    </span>
                  )}
                  {badge && badge.today > 0 && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full font-medium">
                      {badge.today} due today
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-400 space-y-0.5">
                  {client.city && <p>{client.city}{client.state ? `, ${client.state}` : ''}</p>}
                  {client.live_url && (
                    <p className="truncate text-[#E8622A]">{client.live_url.replace(/^https?:\/\//, '')}</p>
                  )}
                  {!client.live_url && <p className="text-gray-300">No live site yet</p>}
                </div>

                {(client.phone || client.email) && (
                  <div
                    className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3 flex-wrap"
                    onClick={e => e.stopPropagation()}
                  >
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="text-xs text-gray-500 hover:text-[#E8622A] flex items-center gap-1 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        {client.phone}
                      </a>
                    )}
                    {client.email && (
                      <a
                        href={`mailto:${client.email}?subject=Your website update from Figure8 Results`}
                        className="text-xs text-gray-500 hover:text-[#E8622A] flex items-center gap-1 transition-colors"
                      >
                        <Mail className="w-3 h-3" />
                        <span className="truncate max-w-[160px]">{client.email}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

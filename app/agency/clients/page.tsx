'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { healthColour } from '@/lib/health';
import type { Client, ClientStatus } from '@/lib/types';
import { Plus, Search } from 'lucide-react';

const STATUS_OPTIONS: (ClientStatus | 'all')[] = ['all', 'active', 'pending', 'complete', 'inactive', 'error'];

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-700',
  running:  'bg-blue-100 text-blue-700',
  error:    'bg-red-100 text-red-700',
  failed:   'bg-red-100 text-red-700',
  complete: 'bg-gray-100 text-gray-600',
  inactive: 'bg-gray-100 text-gray-400',
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<ClientStatus | 'all'>('all');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.from('clients').select('*').order('business_name').then(({ data }) => {
      setClients((data as Client[]) ?? []);
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
          {displayed.map((client, idx) => (
            <Link
              key={client.id}
              href={`/agency/clients/${client.id}`}
              prefetch={idx < 5}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#E8622A]/40 hover:shadow-sm transition-all group"
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
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[client.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {client.status}
                </span>
                {client.niche && (
                  <span className="text-xs bg-[#1a2744] text-white px-2.5 py-0.5 rounded-full">{client.niche}</span>
                )}
              </div>

              <div className="text-xs text-gray-400 space-y-0.5">
                {client.city && <p>{client.city}{client.state ? `, ${client.state}` : ''}</p>}
                {client.live_url && (
                  <p className="truncate text-[#E8622A]">{client.live_url.replace(/^https?:\/\//, '')}</p>
                )}
                {!client.live_url && <p className="text-gray-300">No live site yet</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

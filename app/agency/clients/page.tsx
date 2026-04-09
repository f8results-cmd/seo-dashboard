'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import type { Client, ClientStatus } from '@/lib/types';

const STATUS_OPTIONS: ClientStatus[] = ['pending', 'active', 'complete', 'inactive'];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ClientStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      setClients((data as Client[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = clients.filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.business_name.toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q) ||
        (c.niche ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <Link
          href="/agency/clients/new"
          className="flex items-center gap-2 px-4 py-2 bg-orange-DEFAULT text-white text-sm font-medium rounded-lg hover:bg-orange-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add New Client
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${filter === 'all' ? 'bg-navy-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-navy-300'}`}
          >
            All
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 text-sm rounded-lg font-medium capitalize transition-colors ${filter === s ? 'bg-navy-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-navy-300'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading clients...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No clients found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Business</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Niche</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">City</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Status</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Live URL</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Scores</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/agency/clients/${client.id}`} className="font-medium text-navy-500 hover:text-navy-700">
                        {client.business_name}
                      </Link>
                      {client.owner_name && (
                        <p className="text-xs text-gray-400 mt-0.5">{client.owner_name}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{client.niche ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600">{client.city ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      {client.live_url ? (
                        <a
                          href={client.live_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-navy-500 hover:underline truncate max-w-[140px] block"
                        >
                          {client.live_url.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <ScoreDisplay clientId={client.id} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {format(new Date(client.created_at), 'dd MMM yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-blue-100 text-blue-700',
    inactive: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function ScoreDisplay({ clientId }: { clientId: string }) {
  const [scores, setScores] = useState<{ local_score: number; onsite_score: number; geo_score: number } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('scores')
      .select('local_score, onsite_score, geo_score')
      .eq('client_id', clientId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setScores(data));
  }, [clientId]);

  if (!scores) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex gap-1.5">
      <ScorePill label="L" value={scores.local_score} />
      <ScorePill label="O" value={scores.onsite_score} />
      <ScorePill label="G" value={scores.geo_score} />
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'bg-green-100 text-green-700' : value >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-medium ${color}`}>
      {label}{value}
    </span>
  );
}

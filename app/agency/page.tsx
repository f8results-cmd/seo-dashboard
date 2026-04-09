import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Client, Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AgencyOverviewPage() {
  const supabase = createClient();

  const [
    { data: clients },
    { data: recentJobs },
    { data: scheduledJobs },
  ] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase
      .from('jobs')
      .select('*, clients(business_name)')
      .order('started_at', { ascending: false })
      .limit(10),
    supabase
      .from('scheduled_jobs')
      .select('*, clients(business_name)')
      .gte('run_at', new Date().toISOString())
      .order('run_at', { ascending: true })
      .limit(5),
  ]);

  const allClients = (clients as Client[]) ?? [];
  const activeClients = allClients.filter((c) => c.status === 'active');
  const needsAction = allClients.filter(
    (c) => !c.gbp_location_name || c.status === 'pending'
  );
  const liveWebsites = allClients.filter((c) => !!c.live_url);

  const completedJobs = (recentJobs ?? []).filter((j: Job) => j.status === 'complete');
  const failedJobs = (recentJobs ?? []).filter((j: Job) => j.status === 'error');

  const statCards = [
    { label: 'Active Clients', value: activeClients.length, color: 'bg-navy-500', textColor: 'text-white' },
    { label: 'Needs Action', value: needsAction.length, color: 'bg-orange-DEFAULT', textColor: 'text-white' },
    { label: 'Websites Live', value: liveWebsites.length, color: 'bg-green-500', textColor: 'text-white' },
    { label: 'Total Clients', value: allClients.length, color: 'bg-gray-700', textColor: 'text-white' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <Link
          href="/agency/clients/new"
          className="flex items-center gap-2 px-4 py-2 bg-orange-DEFAULT text-white text-sm font-medium rounded-lg hover:bg-orange-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Client
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, color, textColor }) => (
          <div key={label} className={`${color} rounded-xl p-5 ${textColor}`}>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-sm opacity-80 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clients Needing Action */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Clients Needing Action</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {needsAction.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">All clients up to date</p>
            ) : (
              needsAction.slice(0, 5).map((client) => (
                <Link
                  key={client.id}
                  href={`/agency/clients/${client.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{client.business_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {!client.gbp_location_name ? 'GBP not set up' : 'Pending setup'}
                    </p>
                  </div>
                  <StatusBadge status={client.status} />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Pipeline Activity */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Pipeline Activity</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {(recentJobs ?? []).length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No recent jobs</p>
            ) : (
              (recentJobs ?? []).slice(0, 6).map((job: Job & { clients: { business_name: string } | null }) => (
                <div key={job.id} className="flex items-center justify-between px-6 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {job.clients?.business_name ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{job.agent_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <JobStatusBadge status={job.status} />
                    <span className="text-xs text-gray-400">
                      {job.started_at ? format(new Date(job.started_at), 'dd MMM HH:mm') : '—'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Scheduled Tasks */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Upcoming Scheduled Tasks</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {(scheduledJobs ?? []).length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No upcoming tasks</p>
            ) : (
              (scheduledJobs ?? []).map((job: ScheduledJobWithClient) => (
                <div key={job.id} className="flex items-center justify-between px-6 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {job.clients?.business_name ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{job.job_type}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(job.run_at), 'dd MMM HH:mm')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Quick Stats</h2>
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            {[
              { label: 'Completed Jobs', value: completedJobs.length, sub: 'recent 10' },
              { label: 'Failed Jobs', value: failedJobs.length, sub: 'recent 10' },
              { label: 'Live Websites', value: liveWebsites.length, sub: 'total' },
              { label: 'Active Clients', value: activeClients.length, sub: 'total' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-white px-6 py-5">
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-600 mt-0.5">{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type ScheduledJobWithClient = {
  id: string;
  job_type: string;
  run_at: string;
  clients: { business_name: string } | null;
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-blue-100 text-blue-700',
    inactive: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    running: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

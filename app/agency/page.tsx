import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { format, parseISO, startOfDay, addDays, isToday, isBefore } from 'date-fns';
import { healthColour, calcStaffChecklistPct } from '@/lib/health';
import { formatNiche } from '@/lib/utils';
import type { Client, ClientTask } from '@/lib/types';
import { CheckSquare, Users, Bell, Clock, ChevronRight, Plus, Inbox } from 'lucide-react';

export const revalidate = 30;

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  pending:  'bg-gray-100 text-gray-500',
  running:  'bg-blue-100 text-blue-700',
  error:    'bg-red-100 text-red-700',
  failed:   'bg-red-100 text-red-700',
  complete: 'bg-blue-100 text-blue-700',
  inactive: 'bg-gray-100 text-gray-400',
};

const PRIORITY_COLOUR: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-blue-400',
};

export default async function AgencyDashboard() {
  const supabase = createClient();
  const today = startOfDay(new Date());
  const todayStr  = today.toISOString().split('T')[0];
  const weekStr   = addDays(today, 7).toISOString().split('T')[0];
  const sevenAgo  = addDays(today, -7).toISOString();

  const [
    { data: clients },
    { data: todayTasks },
    { data: weekTasks },
    { data: activeClients },
    { data: latestJobsRaw },
    { count: pendingApprovals },
    { data: recentOutbound },
  ] = await Promise.all([
    supabase.from('clients')
      .select('id, business_name, owner_name, status, health_score, niche, city, state, last_friday_update, onboarding_checklist')
      .order('created_at', { ascending: false }),
    supabase.from('client_tasks')
      .select('*, clients(business_name)')
      .eq('completed', false)
      .lte('due_date', todayStr)
      .order('due_date'),
    supabase.from('client_tasks')
      .select('*, clients(business_name)')
      .eq('completed', false)
      .lte('due_date', weekStr)
      .gt('due_date', todayStr)
      .order('due_date'),
    supabase.from('clients').select('id', { count: 'exact', head: false }).eq('status', 'active'),
    // Single query for latest job per client — avoids N+1 per-client lookups
    supabase.from('jobs')
      .select('client_id, started_at, status')
      .not('agent_name', 'eq', '_pipeline_failure')
      .order('started_at', { ascending: false })
      .limit(1000),
    // Pending approvals count — null-safe if table doesn't exist yet
    supabase.from('approval_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // Recent outbound (last 8 sends)
    supabase.from('outbound_log')
      .select('id, surface, subject, sent_at, clients(business_name)')
      .order('sent_at', { ascending: false })
      .limit(8),
  ]);

  const allClients = (clients ?? []) as Client[];
  const tasksDueToday = (todayTasks ?? []) as (ClientTask & { clients: { business_name: string } | null })[];
  const tasksDueWeek  = (weekTasks  ?? []) as (ClientTask & { clients: { business_name: string } | null })[];

  // Build map: client_id → latest job (first row per client since ordered desc)
  const lastJobByClient: Record<string, { started_at: string; status: string }> = {};
  for (const job of (latestJobsRaw ?? [])) {
    if (!lastJobByClient[job.client_id]) {
      lastJobByClient[job.client_id] = { started_at: job.started_at, status: job.status };
    }
  }

  // Compute reminder count: active clients missing friday update in 7 days
  const updatesNeeded = allClients.filter(c =>
    c.status === 'active' &&
    (!c.last_friday_update || new Date(c.last_friday_update) < new Date(sevenAgo))
  ).length;

  const activeCount = (activeClients ?? []).length;
  const approvalCount = pendingApprovals ?? 0;

  // Stats
  const stats = [
    { label: 'Active Clients',      value: activeCount,                   icon: Users,       colour: 'bg-[#1a2744]',   href: '/agency/clients' },
    { label: 'Pending Approvals',   value: approvalCount,                 icon: Inbox,       colour: approvalCount > 0 ? 'bg-[#E8622A]' : 'bg-gray-400', href: '/agency/approvals' },
    { label: 'Tasks This Week',     value: tasksDueToday.length + tasksDueWeek.length, icon: Clock, colour: 'bg-amber-500', href: '/agency/todo' },
    { label: 'Updates Due',         value: updatesNeeded,                 icon: Bell,        colour: 'bg-purple-600',  href: '/agency/reminders' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <Link
          href="/agency/onboard"
          className="flex items-center gap-2 bg-[#E8622A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#d05520] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Client
        </Link>
      </div>

      {/* Stat cards — all clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className={`${s.colour} rounded-xl p-5 text-white hover:opacity-90 transition-opacity block`}>
            <s.icon className="w-5 h-5 opacity-70 mb-2" />
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm opacity-80 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Two-column: tasks + reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks today */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Your tasks today</h2>
            <Link href="/agency/todo" className="text-xs text-[#E8622A] hover:underline">See all</Link>
          </div>
          {tasksDueToday.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">No tasks due today.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {tasksDueToday.map(task => (
                <li key={task.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_COLOUR[task.priority] ?? 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium leading-snug">{task.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{task.clients?.business_name ?? '—'}</p>
                  </div>
                  {task.due_date && (
                    <span className={`text-xs flex-shrink-0 ${
                      isBefore(parseISO(task.due_date), today) ? 'text-red-500 font-medium' : 'text-gray-400'
                    }`}>
                      {isToday(parseISO(task.due_date)) ? 'Today' : format(parseISO(task.due_date), 'd MMM')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming reminders */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Upcoming reminders</h2>
            <Link href="/agency/reminders" className="text-xs text-[#E8622A] hover:underline">See all</Link>
          </div>
          {updatesNeeded === 0 && tasksDueWeek.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">Nothing pending this week.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {/* Friday updates due */}
              {allClients
                .filter(c =>
                  c.status === 'active' &&
                  (!c.last_friday_update || new Date(c.last_friday_update) < new Date(sevenAgo))
                )
                .slice(0, 5)
                .map(c => (
                  <li key={`fu-${c.id}`} className="flex items-center gap-3 px-5 py-3.5">
                    <Bell className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">{c.business_name}</p>
                      <p className="text-xs text-gray-400">Friday update overdue</p>
                    </div>
                    <Link href={`/agency/clients/${c.id}?tab=friday`} className="text-[#E8622A]">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </li>
                ))
              }
              {/* Tasks due this week */}
              {tasksDueWeek.slice(0, 5 - Math.min(5, updatesNeeded)).map(task => (
                <li key={task.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_COLOUR[task.priority] ?? 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium leading-snug">{task.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{task.clients?.business_name ?? '—'}</p>
                  </div>
                  {task.due_date && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {format(parseISO(task.due_date), 'd MMM')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent outbound */}
      {(recentOutbound ?? []).length > 0 && (() => {
        type OutboundRow = { id: string; surface: string; subject: string | null; sent_at: string; clients: { business_name: string } | null };
        const rows = (recentOutbound ?? []) as unknown as OutboundRow[];
        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recently published</h2>
              <Link href="/agency/approvals" className="text-xs text-[#E8622A] hover:underline">View queue</Link>
            </div>
            <ul className="divide-y divide-gray-50">
              {rows.map(row => (
                <li key={row.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    row.surface === 'gbp_post' ? 'bg-blue-100 text-blue-700' :
                    row.surface === 'email' ? 'bg-purple-100 text-purple-700' :
                    row.surface === 'review_reply' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {row.surface.replace('_', ' ')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{row.clients?.business_name ?? '—'}</p>
                    {row.subject && <p className="text-xs text-gray-400 truncate">{row.subject}</p>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {format(parseISO(row.sent_at), 'd MMM HH:mm')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Client table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">All clients</h2>
          <Link href="/agency/clients" className="text-xs text-[#E8622A] hover:underline">Manage clients</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Niche / City</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-center">Health</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Last Update</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allClients.map((client, idx) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/agency/clients/${client.id}`}
                      prefetch={idx < 5}
                      className="font-medium text-gray-900 hover:text-[#E8622A] transition-colors"
                    >
                      {client.business_name}
                    </Link>
                    {client.owner_name && (
                      <p className="text-xs text-gray-400 mt-0.5">{client.owner_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <div className="flex flex-col gap-0.5">
                      {client.niche && (
                        <span className="inline-flex w-fit bg-[#1a2744] text-white text-xs px-2 py-0.5 rounded-full">{formatNiche(client.niche)}</span>
                      )}
                      {client.city && (
                        <span className="text-xs text-gray-400">{client.city}{client.state ? `, ${client.state}` : ''}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const displayStatus = lastJobByClient[client.id] ? client.status : 'pending';
                      return (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[displayStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                          {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: healthColour(client.health_score ?? 0) }}
                    >
                      {client.health_score ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const { pct, complete, total } = calcStaffChecklistPct(client);
                      return (
                        <div className="flex items-center gap-2 min-w-[90px]">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: pct === 100 ? '#22c55e' : pct >= 50 ? '#f97316' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap w-14 text-right">
                            {complete}/{total}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    <div className="flex flex-col gap-1">
                      {client.last_friday_update
                        ? format(parseISO(client.last_friday_update), 'd MMM yyyy')
                        : <span className="text-red-400">Never</span>
                      }
                      {lastJobByClient[client.id] && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full w-fit font-medium ${STATUS_STYLES[lastJobByClient[client.id].status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {lastJobByClient[client.id].status}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/agency/clients/${client.id}`}
                      prefetch={idx < 5}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#E8622A] transition-colors whitespace-nowrap ml-auto w-fit"
                    >
                      Open <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {allClients.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">No clients yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

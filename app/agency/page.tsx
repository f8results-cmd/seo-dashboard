import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { format, parseISO, startOfDay, addDays, isToday, isBefore } from 'date-fns';
import { healthColour } from '@/lib/health';
import type { Client, ClientTask } from '@/lib/types';
import { CheckSquare, Users, Bell, Clock, ChevronRight, Plus } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-700',
  running:  'bg-blue-100 text-blue-700',
  error:    'bg-red-100 text-red-700',
  failed:   'bg-red-100 text-red-700',
  complete: 'bg-gray-100 text-gray-600',
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
  ] = await Promise.all([
    supabase.from('clients').select('*').order('business_name'),
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
  ]);

  const allClients = (clients ?? []) as Client[];
  const tasksDueToday = (todayTasks ?? []) as (ClientTask & { clients: { business_name: string } | null })[];
  const tasksDueWeek  = (weekTasks  ?? []) as (ClientTask & { clients: { business_name: string } | null })[];

  // Compute reminder count: active clients missing friday update in 7 days
  const updatesNeeded = allClients.filter(c =>
    c.status === 'active' &&
    (!c.last_friday_update || new Date(c.last_friday_update) < new Date(sevenAgo))
  ).length;

  const activeCount = (activeClients ?? []).length;

  // Stats
  const stats = [
    { label: 'Active Clients',     value: activeCount,                   icon: Users,       colour: 'bg-[#1a2744]' },
    { label: 'Tasks Due Today',    value: tasksDueToday.length,          icon: CheckSquare, colour: 'bg-[#E8622A]' },
    { label: 'Tasks This Week',    value: tasksDueToday.length + tasksDueWeek.length, icon: Clock, colour: 'bg-amber-500' },
    { label: 'Updates Due',        value: updatesNeeded,                 icon: Bell,        colour: 'bg-purple-600' },
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`${s.colour} rounded-xl p-5 text-white`}>
            <s.icon className="w-5 h-5 opacity-70 mb-2" />
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm opacity-80 mt-0.5">{s.label}</p>
          </div>
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
                <th className="px-4 py-3 font-medium">Last Update</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allClients.map(client => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/agency/clients/${client.id}`}
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
                        <span className="inline-flex w-fit bg-[#1a2744] text-white text-xs px-2 py-0.5 rounded-full">{client.niche}</span>
                      )}
                      {client.city && (
                        <span className="text-xs text-gray-400">{client.city}{client.state ? `, ${client.state}` : ''}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[client.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: healthColour(client.health_score ?? 0) }}
                    >
                      {client.health_score ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {client.last_friday_update
                      ? format(parseISO(client.last_friday_update), 'd MMM yyyy')
                      : <span className="text-red-400">Never</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/agency/clients/${client.id}`}
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

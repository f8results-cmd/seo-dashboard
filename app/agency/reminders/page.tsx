import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { subDays, format, parseISO } from 'date-fns';
import type { Client, ClientTask } from '@/lib/types';
import { Bell, CheckSquare, Camera, AlertTriangle } from 'lucide-react';

interface ReminderItem {
  id: string;
  client_id: string;
  client_name: string;
  description: string;
  type: 'friday_update' | 'onboarding' | 'task' | 'rank_screenshot';
  overdue: boolean;
  href: string;
}

export default async function RemindersPage() {
  const supabase = createClient();
  const sevenDaysAgo = subDays(new Date(), 7).toISOString();
  const today = new Date().toISOString().split('T')[0];

  const [{ data: clients }, { data: overdueTasks }] = await Promise.all([
    supabase.from('clients')
      .select('id, business_name, status, last_friday_update, onboarding_checklist, created_at')
      .in('status', ['active', 'pending', 'running']),
    supabase.from('client_tasks')
      .select('*, clients(id, business_name)')
      .eq('completed', false)
      .lte('due_date', today)
      .order('due_date'),
  ]);

  const reminders: ReminderItem[] = [];

  // Friday update reminders
  for (const c of (clients ?? []) as Client[]) {
    if (c.status === 'active') {
      const needsUpdate = !c.last_friday_update || new Date(c.last_friday_update) < new Date(sevenDaysAgo);
      if (needsUpdate) {
        const lastDate = c.last_friday_update
          ? `Last sent ${format(parseISO(c.last_friday_update), 'd MMM')}`
          : 'Never sent';
        reminders.push({
          id: `fu-${c.id}`,
          client_id: c.id,
          client_name: c.business_name,
          description: `Friday update overdue — ${lastDate}`,
          type: 'friday_update',
          overdue: true,
          href: `/agency/clients/${c.id}?tab=friday`,
        });
      }
    }

    // Onboarding stuck
    if (c.status === 'pending' && c.created_at && new Date(c.created_at) < subDays(new Date(), 7)) {
      const checklist = c.onboarding_checklist as Record<string, boolean> | null;
      if (!checklist?.ghl_created) {
        reminders.push({
          id: `ob-${c.id}`,
          client_id: c.id,
          client_name: c.business_name,
          description: 'Onboarding incomplete — pending for over 7 days',
          type: 'onboarding',
          overdue: true,
          href: `/agency/clients/${c.id}`,
        });
      }
    }
  }

  // Overdue tasks
  for (const t of (overdueTasks ?? []) as (ClientTask & { clients: { id: string; business_name: string } | null })[]) {
    reminders.push({
      id: `task-${t.id}`,
      client_id: t.client_id,
      client_name: t.clients?.business_name ?? 'Unknown',
      description: t.description + (t.due_date ? ` — due ${format(parseISO(t.due_date), 'd MMM')}` : ''),
      type: 'task',
      overdue: true,
      href: `/agency/clients/${t.client_id}?tab=todo`,
    });
  }

  const ICON: Record<string, React.ElementType> = {
    friday_update:   Bell,
    onboarding:      AlertTriangle,
    task:            CheckSquare,
    rank_screenshot: Camera,
  };

  const TYPE_COLOUR: Record<string, string> = {
    friday_update:   'bg-purple-100 text-purple-600',
    onboarding:      'bg-amber-100 text-amber-600',
    task:            'bg-red-100 text-red-600',
    rank_screenshot: 'bg-blue-100 text-blue-600',
  };

  const TYPE_LABEL: Record<string, string> = {
    friday_update:   'Friday Update',
    onboarding:      'Onboarding',
    task:            'Overdue Task',
    rank_screenshot: 'Rank Screenshot',
  };

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{reminders.length} item{reminders.length !== 1 ? 's' : ''} need attention</p>
        </div>
      </div>

      {reminders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-gray-600 font-medium">All caught up!</p>
          <p className="text-sm text-gray-400 mt-1">No reminders pending.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map(r => {
            const Icon = ICON[r.type] ?? Bell;
            return (
              <Link
                key={r.id}
                href={r.href}
                className="flex items-start gap-4 bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-[#E8622A]/30 hover:shadow-sm transition-all group"
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${TYPE_COLOUR[r.type] ?? 'bg-gray-100 text-gray-500'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm group-hover:text-[#E8622A] transition-colors">
                    {r.client_name}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${TYPE_COLOUR[r.type] ?? 'bg-gray-100 text-gray-500'}`}>
                  {TYPE_LABEL[r.type] ?? r.type}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

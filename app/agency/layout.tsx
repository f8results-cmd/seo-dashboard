import { createClient } from '@/lib/supabase/server';
import AgencySidebar from '@/components/agency/Sidebar';
import { subDays } from 'date-fns';

async function getReminderCount(): Promise<number> {
  try {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = subDays(new Date(), 7).toISOString();

    const { data: clients } = await supabase
      .from('clients')
      .select('id, last_friday_update, onboarding_checklist, created_at, status')
      .in('status', ['active', 'pending', 'running']);

    if (!clients) return 0;

    let count = 0;
    for (const c of clients) {
      // Friday update overdue
      if (!c.last_friday_update || new Date(c.last_friday_update) < new Date(sevenDaysAgo)) {
        if (c.status === 'active') count++;
      }
      // Onboarding incomplete after 7 days
      const checklist = c.onboarding_checklist as Record<string, boolean> | null;
      if (
        c.status === 'pending' &&
        c.created_at &&
        new Date(c.created_at) < subDays(new Date(), 7) &&
        (!checklist || !checklist.ghl_created)
      ) {
        count++;
      }
    }

    // Overdue tasks (count separately)
    const { count: taskCount } = await supabase
      .from('client_tasks')
      .select('id', { count: 'exact', head: true })
      .lt('due_date', today)
      .eq('completed', false);

    return count + (taskCount ?? 0);
  } catch {
    return 0;
  }
}

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const reminderCount = await getReminderCount();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AgencySidebar reminderCount={reminderCount} />
      <main className="flex-1 md:ml-[240px] pt-14 md:pt-0 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}

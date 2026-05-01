import { createClient } from '@/lib/supabase/server';
import ApprovalsClient from './ApprovalsClient';
import type { ApprovalQueueItem } from '@/lib/types';

export const revalidate = 0;

export default async function ApprovalsPage() {
  const supabase = createClient();

  const { data: items, error } = await supabase
    .from('approval_queue')
    .select('*, clients(business_name, city, niche)')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error && error.code === 'PGRST204') {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 text-sm">
          Approval queue table not set up yet. Run migration <code>020_approval_queue.sql</code> in Supabase.
        </p>
      </div>
    );
  }

  return <ApprovalsClient initialItems={(items ?? []) as ApprovalQueueItem[]} />;
}

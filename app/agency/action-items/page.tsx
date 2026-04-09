import { createClient } from '@/lib/supabase/server';
import ActionItemList from '@/components/agency/ActionItemList';

export const dynamic = 'force-dynamic';

export default async function ActionItemsPage() {
  const supabase = createClient();

  const [
    { data: clients },
    { data: reviews },
    { data: posts },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, business_name, status, gbp_location_name, live_url')
      .in('status', ['pending', 'active']),
    supabase
      .from('review_responses')
      .select('*, clients(business_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('gbp_posts')
      .select('*, clients(business_name)')
      .eq('status', 'scheduled')
      .order('scheduled_date', { ascending: true }),
  ]);

  // Clients missing GBP
  const noGbp = (clients ?? []).filter((c: { gbp_location_name: string | null }) => !c.gbp_location_name);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Action Items</h1>
        <p className="text-sm text-gray-500 mt-0.5">Everything that needs your manual attention</p>
      </div>

      <div className="space-y-6">
        {/* GBP Setup Required */}
        {noGbp.length > 0 && (
          <Section title="GBP Setup Required" count={noGbp.length} color="orange">
            <div className="divide-y divide-gray-50">
              {noGbp.map((client) => (
                <div key={client.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{client.business_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Google Business Profile not connected</p>
                  </div>
                  <a
                    href={`/agency/clients/${client.id}`}
                    className="text-xs px-3 py-1.5 bg-orange-DEFAULT text-white rounded-lg hover:bg-orange-500 transition-colors font-medium"
                  >
                    View GBP Guide
                  </a>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Review Responses */}
        <Section title="Review Responses to Post" count={(reviews ?? []).length} color="blue">
          <ActionItemList items={reviews ?? []} type="review" />
        </Section>

        {/* GBP Posts to Schedule */}
        <Section title="GBP Posts to Schedule" count={(posts ?? []).length} color="green">
          <ActionItemList items={posts ?? []} type="post" />
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  const badgeColors: Record<string, string> = {
    orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badgeColors[color]}`}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">All clear!</div>
      ) : (
        children
      )}
    </div>
  );
}

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import RankHistoryChart from '@/components/portal/RankHistoryChart';

export const dynamic = 'force-dynamic';

export default async function RankingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/portal');

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('email', user.email ?? '')
    .single();

  if (!client) redirect('/portal');

  const { data: rankings } = await supabase
    .from('rank_tracking')
    .select('*')
    .eq('client_id', client.id)
    .order('checked_at', { ascending: false });

  // Deduplicate by keyword — keep latest per keyword (rows ordered by checked_at desc)
  const latestPerKeyword = new Map<string, { id: string; keyword: string; position: number | null; local_pack: boolean; checked_at: string }>();
  for (const r of (rankings ?? []) as { id: string; keyword: string; position: number | null; local_pack: boolean; checked_at: string }[]) {
    if (!latestPerKeyword.has(r.keyword)) {
      latestPerKeyword.set(r.keyword, r);
    }
  }
  const currentRankings = Array.from(latestPerKeyword.values());

  // Top 3 keywords for history chart
  const top3 = currentRankings
    .filter((r) => r.position !== null)
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .slice(0, 3)
    .map((r) => r.keyword);

  const chartData = top3.map((keyword) => ({
    keyword,
    history: ((rankings ?? []) as { keyword: string; position: number | null; checked_at: string }[])
      .filter((r) => r.keyword === keyword)
      .slice(0, 12)
      .reverse()
      .map((r) => ({
        date: format(new Date(r.checked_at), 'dd MMM'),
        position: r.position,
      })),
  }));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Keyword Rankings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track your position in Google search results</p>
      </div>

      {/* Current Rankings Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Current Positions</h2>
        </div>
        {currentRankings.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No ranking data yet — check back after your next monthly report.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500">Keyword</th>
                  <th className="text-center px-4 py-3.5 font-medium text-gray-500">Position</th>
                  <th className="text-center px-4 py-3.5 font-medium text-gray-500">Change</th>
                  <th className="text-center px-4 py-3.5 font-medium text-gray-500">Local Pack</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentRankings.map((r) => {
                  // Compute movement from the 2nd-most-recent entry for this keyword
                  const history = ((rankings ?? []) as { keyword: string; position: number | null }[])
                    .filter((h) => h.keyword === r.keyword);
                  const prev = history[1];
                  const movement = prev?.position != null && r.position != null
                    ? prev.position - r.position
                    : null;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3.5 font-medium text-gray-800">{r.keyword}</td>
                      <td className="px-4 py-3.5 text-center">
                        {r.position ? (
                          <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold ${
                            r.position <= 3 ? 'bg-green-100 text-green-700' :
                            r.position <= 10 ? 'bg-blue-100 text-blue-700' :
                            r.position <= 20 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {r.position}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {movement !== null ? <MovementBadge movement={movement} /> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {r.local_pack ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-full font-medium">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-gray-400">
                        {format(new Date(r.checked_at), 'dd MMM yyyy')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Position History — Top Keywords</h2>
          <RankHistoryChart data={chartData} />
        </div>
      )}
    </div>
  );
}

function MovementBadge({ movement }: { movement: number }) {
  if (movement > 0) return (
    <span className="inline-flex items-center gap-0.5 text-sm font-medium text-green-600">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
      {movement}
    </span>
  );
  if (movement < 0) return (
    <span className="inline-flex items-center gap-0.5 text-sm font-medium text-red-500">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      {Math.abs(movement)}
    </span>
  );
  return <span className="text-gray-400 text-sm">—</span>;
}

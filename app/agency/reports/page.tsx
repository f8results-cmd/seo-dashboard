import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AgencyReportsPage() {
  const supabase = createClient();

  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .in('status', ['active', 'complete'])
    .order('business_name');

  const { data: reports } = await supabase
    .from('monthly_reports')
    .select('*, clients(business_name)')
    .order('created_at', { ascending: false });

  const { data: rankings } = await supabase
    .from('keyword_rankings')
    .select('*, clients(business_name)')
    .order('recorded_at', { ascending: false })
    .limit(50);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Reports */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Monthly Reports</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {(reports ?? []).length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No reports yet</div>
            ) : (
              (reports ?? []).map((report: ReportWithClient) => (
                <div key={report.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {report.clients?.business_name ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {report.month} · Generated {format(new Date(report.created_at), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.pdf_url ? (
                      <a
                        href={report.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-navy-500 text-white rounded-lg hover:bg-navy-600 transition-colors font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        PDF
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">No PDF</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rank Tracking */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Rank Tracking</h2>
          </div>
          <div className="overflow-x-auto">
            {(rankings ?? []).length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No keyword data yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Business</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Keyword</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Pos.</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Move</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Pack</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(rankings ?? []).map((r: RankWithClient) => {
                    const movement = r.previous_position && r.position
                      ? r.previous_position - r.position
                      : null;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-700 text-xs">{r.clients?.business_name ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-800">{r.keyword}</td>
                        <td className="px-4 py-3 text-center font-mono font-medium text-gray-900">
                          {r.position ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {movement !== null ? (
                            <MovementBadge movement={movement} />
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.in_local_pack ? (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Yes</span>
                          ) : (
                            <span className="text-xs text-gray-400">No</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MovementBadge({ movement }: { movement: number }) {
  if (movement > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
      +{movement}
    </span>
  );
  if (movement < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-500">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      {movement}
    </span>
  );
  return <span className="text-xs text-gray-400">—</span>;
}

type ReportWithClient = {
  id: string;
  month: string;
  pdf_url: string | null;
  created_at: string;
  clients: { business_name: string } | null;
};

type RankWithClient = {
  id: string;
  keyword: string;
  position: number | null;
  previous_position: number | null;
  in_local_pack: boolean;
  clients: { business_name: string } | null;
};

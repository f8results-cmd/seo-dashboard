import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function PortalReportsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/portal');

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('email', user.email ?? '')
    .single();

  if (!client) redirect('/portal');

  const { data: reports } = await supabase
    .from('monthly_reports')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Monthly Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your SEO performance reports</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        {(reports ?? []).length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No reports yet</p>
            <p className="text-xs text-gray-400 mt-1">Your first report will appear at the end of the month</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(reports ?? []).map((report: ReportRow) => (
              <div key={report.id} className="px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-navy-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{report.month} Report</p>
                        <p className="text-xs text-gray-400">
                          Generated {format(new Date(report.created_at), 'dd MMMM yyyy')}
                        </p>
                      </div>
                    </div>
                    {report.summary && (
                      <p className="text-sm text-gray-600 leading-relaxed pl-13">
                        {report.summary}
                      </p>
                    )}
                  </div>
                  {report.pdf_url && (
                    <a
                      href={report.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 bg-navy-500 text-white text-sm font-medium rounded-lg hover:bg-navy-600 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download PDF
                    </a>
                  )}
                </div>
                {!report.pdf_url && report.summary && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Full Report</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{report.summary}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type ReportRow = {
  id: string;
  month: string;
  summary: string | null;
  pdf_url: string | null;
  created_at: string;
};

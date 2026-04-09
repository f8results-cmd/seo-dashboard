import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import type { Score } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PortalOverviewPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/portal');

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('email', user.email ?? '')
    .single();

  if (!client) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-16 text-center">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No account found</h2>
          <p className="text-sm text-gray-500">
            We couldn&apos;t find a client account linked to <strong>{user.email}</strong>.<br />
            Please contact Figure8 Results for access.
          </p>
        </div>
      </div>
    );
  }

  const [
    { data: scores },
    { data: recentPosts },
    { data: recentReviews },
    { data: rankings },
    { data: nextActions },
  ] = await Promise.all([
    supabase.from('scores').select('*').eq('client_id', client.id).order('recorded_at', { ascending: false }).limit(2),
    supabase.from('gbp_posts').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('review_responses').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('rank_tracking').select('*').eq('client_id', client.id).order('checked_at', { ascending: false }).limit(5),
    supabase.from('scheduled_jobs').select('*').eq('client_id', client.id).gte('run_at', new Date().toISOString()).order('run_at', { ascending: true }).limit(3),
  ]);

  const latestScore = (scores as Score[])?.[0];
  const prevScore = (scores as Score[])?.[1];

  const postsThisMonth = (recentPosts ?? []).filter((p: { created_at: string }) => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const reviewsRespondedThisMonth = (recentReviews ?? []).filter((r: { posted: boolean; created_at: string }) => {
    const d = new Date(r.created_at);
    const now = new Date();
    return r.posted && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {client.owner_name?.split(' ')[0] ?? client.business_name}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* Website Card */}
      {client.live_url && (
        <div className="bg-navy-500 text-white rounded-xl p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-navy-200 mb-1">Your Website</p>
            <a href={client.live_url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold hover:underline">
              {client.live_url.replace(/^https?:\/\//, '')}
            </a>
          </div>
          <a
            href={client.live_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Visit Site
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      )}

      {/* SEO Scores */}
      {latestScore && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">SEO Scores</h2>
          <div className="grid grid-cols-3 gap-4">
            <ScoreCard label="Local SEO" current={latestScore.local_seo_score} previous={prevScore?.local_seo_score} />
            <ScoreCard label="On-Site" current={latestScore.onsite_seo_score} previous={prevScore?.onsite_seo_score} />
            <ScoreCard label="Geo Coverage" current={latestScore.geo_score} previous={prevScore?.geo_score} />
          </div>
          <p className="text-xs text-gray-400 mt-3">Last updated {format(new Date(latestScore.recorded_at), 'dd MMMM yyyy')}</p>
        </div>
      )}

      {/* This Month */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Posts Published" value={postsThisMonth} sub="this month" />
        <StatCard label="Reviews Responded" value={reviewsRespondedThisMonth} sub="this month" />
        <StatCard label="Keywords Tracked" value={(rankings ?? []).length} sub="total" />
        <StatCard label="SEO Score" value={latestScore ? Math.round((latestScore.local_seo_score + latestScore.onsite_seo_score + latestScore.geo_score) / 3) : '—'} sub="average" />
      </div>

      {/* Next Actions */}
      {(nextActions ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Next Scheduled Actions</h2>
          <div className="space-y-3">
            {(nextActions ?? []).map((job: { id: string; job_type: string; run_at: string }) => (
              <div key={job.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-orange-DEFAULT" />
                  <span className="text-sm text-gray-800 capitalize">{job.job_type.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {format(new Date(job.run_at), 'dd MMM, h:mm a')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, current, previous }: { label: string; current: number; previous?: number }) {
  const change = previous !== undefined ? current - previous : null;
  const color = current >= 70 ? 'text-green-600' : current >= 40 ? 'text-yellow-600' : 'text-red-500';
  const barColor = current >= 70 ? 'bg-green-500' : current >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${color}`}>{current}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {change !== null && change !== 0 && (
        <div className={`text-xs mt-0.5 ${change > 0 ? 'text-green-600' : 'text-red-500'}`}>
          {change > 0 ? `+${change}` : change} pts
        </div>
      )}
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${current}%` }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600 mt-0.5">{label}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}

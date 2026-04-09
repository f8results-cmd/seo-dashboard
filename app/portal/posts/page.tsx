import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function PostsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/portal');

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('email', user.email ?? '')
    .single();

  if (!client) redirect('/portal');

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const { data: posts } = await supabase
    .from('gbp_posts')
    .select('*')
    .eq('client_id', client.id)
    .gte('scheduled_date', monthStart.toISOString())
    .lte('scheduled_date', monthEnd.toISOString())
    .order('scheduled_date', { ascending: true });

  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay(); // 0=Sun

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">GBP Posts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Google Business Profile post calendar — {format(now, 'MMMM yyyy')}</p>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{format(now, 'MMMM yyyy')}</h2>
        </div>
        <div className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {allDays.map((day) => {
              const dayPosts = (posts ?? []).filter((p: { scheduled_date: string | null }) =>
                p.scheduled_date && isSameDay(new Date(p.scheduled_date), day)
              );
              const isToday = isSameDay(day, now);
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[68px] rounded-lg p-1.5 text-xs ${isToday ? 'bg-navy-50 ring-1 ring-navy-500' : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                  <span className={`font-medium ${isToday ? 'text-navy-700' : 'text-gray-600'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayPosts.map((p: { id: string; post_type: string | null; status: string }) => (
                      <div
                        key={p.id}
                        className={`truncate px-1 py-0.5 rounded text-[10px] font-medium ${
                          p.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {p.post_type ?? 'Post'}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Post List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">All Posts This Month</h2>
        </div>
        {(posts ?? []).length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No posts scheduled this month</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(posts ?? []).map((post: GbpPost) => (
              <div key={post.id} className="px-6 py-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2.5">
                    {post.post_type && (
                      <span className="text-xs px-2.5 py-1 bg-navy-50 text-navy-600 rounded-full font-medium">
                        {post.post_type}
                      </span>
                    )}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      post.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {post.status === 'posted' ? 'Posted' : 'Scheduled'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {post.scheduled_date
                      ? format(new Date(post.scheduled_date), 'dd MMM yyyy')
                      : format(new Date(post.created_at), 'dd MMM yyyy')}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type GbpPost = {
  id: string;
  content: string;
  post_type: string | null;
  scheduled_date: string | null;
  status: string;
  created_at: string;
};

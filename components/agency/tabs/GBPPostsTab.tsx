'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import type { GbpPost, PostStatus } from '@/lib/types';

const STATUS_STYLES: Record<PostStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  posted:    'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
};

export default function GBPPostsTab({ clientId }: { clientId: string }) {
  const [posts, setPosts] = useState<GbpPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PostStatus | 'all'>('all');
  const [selected, setSelected] = useState<GbpPost | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('gbp_posts')
      .select('*')
      .eq('client_id', clientId)
      .order('scheduled_date', { ascending: true });
    setPosts((data ?? []) as GbpPost[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter);
  const counts = {
    all: posts.length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    posted: posts.filter(p => p.status === 'posted').length,
    failed: posts.filter(p => p.status === 'failed').length,
  };

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{posts.length} / 52 Posts</h2>
        <div className="flex gap-1">
          {(['all', 'scheduled', 'posted', 'failed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize
                ${filter === f ? 'bg-[#1a2744] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No posts found.</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium w-12">#</th>
              <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium">Date</th>
              <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium flex-1">Preview</th>
              <th className="text-left py-2 text-xs text-gray-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((post, i) => (
              <tr
                key={post.id}
                onClick={() => setSelected(post)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="py-3 pr-4 text-gray-400 text-xs">{i + 1}</td>
                <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                  {post.scheduled_date ? format(parseISO(post.scheduled_date), 'd MMM yyyy') : '—'}
                </td>
                <td className="py-3 pr-4 text-gray-700 max-w-xs truncate">
                  {post.content.slice(0, 100)}
                </td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[post.status]}`}>
                    {post.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-gray-900">
                  {selected.scheduled_date ? format(parseISO(selected.scheduled_date), 'd MMMM yyyy') : 'Post'}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[selected.status]}`}>
                  {selected.status}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}

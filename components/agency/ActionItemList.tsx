'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

type ReviewItem = {
  id: string;
  reviewer_name: string | null;
  review_text: string | null;
  rating: number | null;
  draft_response: string | null;
  status: string;
  created_at: string;
  clients: { business_name: string } | null;
};

type PostItem = {
  id: string;
  content: string;
  post_type: string | null;
  scheduled_date: string | null;
  status: string;
  created_at: string;
  clients: { business_name: string } | null;
};

export default function ActionItemList({
  items,
  type,
}: {
  items: (ReviewItem | PostItem)[];
  type: 'review' | 'post';
}) {
  const router = useRouter();
  const [copying, setCopying] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  async function markDone(id: string) {
    setMarking(id);
    const supabase = createClient();
    if (type === 'review') {
      await supabase.from('review_responses').update({ status: 'posted' }).eq('id', id);
    } else {
      await supabase.from('gbp_posts').update({ status: 'posted' }).eq('id', id);
    }
    setMarking(null);
    router.refresh();
  }

  async function copyContent(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopying(id);
    setTimeout(() => setCopying(null), 1500);
  }

  if (items.length === 0) {
    return <div className="py-10 text-center text-sm text-gray-400">Nothing to do here!</div>;
  }

  return (
    <div className="divide-y divide-gray-50">
      {items.map((item) => {
        const isReview = type === 'review';
        const review = item as ReviewItem;
        const post = item as PostItem;
        const copyText = isReview ? (review.draft_response ?? '') : post.content;

        return (
          <div key={item.id} className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-1.5">
                  <span className="text-sm font-medium text-gray-900">
                    {item.clients?.business_name ?? '—'}
                  </span>
                  {isReview && review.rating && (
                    <StarRating rating={review.rating} />
                  )}
                  {!isReview && post.post_type && (
                    <span className="text-xs px-2 py-0.5 bg-navy-50 text-navy-600 rounded-full">{post.post_type}</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {isReview
                      ? format(new Date(item.created_at), 'dd MMM yyyy')
                      : post.scheduled_date
                        ? format(new Date(post.scheduled_date), 'dd MMM yyyy')
                        : format(new Date(item.created_at), 'dd MMM yyyy')}
                  </span>
                </div>

                {isReview && review.reviewer_name && (
                  <p className="text-xs text-gray-500 mb-2">From: {review.reviewer_name}</p>
                )}
                {isReview && review.review_text && (
                  <p className="text-sm text-gray-600 mb-3 italic">&ldquo;{review.review_text}&rdquo;</p>
                )}

                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {isReview ? (review.draft_response ?? 'No draft available') : post.content}
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => copyContent(item.id, copyText)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copying === item.id ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() => markDone(item.id)}
                  disabled={marking === item.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {marking === item.id ? '…' : 'Mark Posted'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= rating ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

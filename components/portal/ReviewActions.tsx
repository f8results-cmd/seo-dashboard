'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type ReviewRow = {
  id: string;
  response_draft: string | null;
  posted: boolean;
};

export default function ReviewActions({ review }: { review: ReviewRow }) {
  const router = useRouter();
  const [copying, setCopying] = useState(false);
  const [marking, setMarking] = useState(false);

  if (review.posted) {
    return (
      <span className="flex-shrink-0 text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium">
        Posted
      </span>
    );
  }

  async function copyDraft() {
    if (!review.response_draft) return;
    await navigator.clipboard.writeText(review.response_draft);
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
  }

  async function markPosted() {
    setMarking(true);
    const supabase = createClient();
    await supabase.from('review_responses').update({ posted: true }).eq('id', review.id);
    setMarking(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 flex-shrink-0">
      {review.response_draft && (
        <button
          onClick={copyDraft}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {copying ? (
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
      )}
      <button
        onClick={markPosted}
        disabled={marking}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        {marking ? '...' : 'Mark Posted'}
      </button>
    </div>
  );
}

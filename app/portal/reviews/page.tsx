import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import ReviewActions from '@/components/portal/ReviewActions';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/portal');

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('email', user.email ?? '')
    .single();

  if (!client) redirect('/portal');

  const { data: reviews } = await supabase
    .from('review_responses')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false });

  const avgRating = (reviews ?? []).length > 0
    ? ((reviews ?? []).reduce((sum: number, r: { rating: number | null }) => sum + (r.rating ?? 0), 0) / (reviews ?? []).length).toFixed(1)
    : null;

  const responded = (reviews ?? []).filter((r: { posted: boolean }) => r.posted).length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Google Reviews</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your recent reviews and drafted responses</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{avgRating ?? '—'}</p>
          <div className="flex justify-center mt-1 mb-1">
            {avgRating && <StarRating rating={parseFloat(avgRating)} />}
          </div>
          <p className="text-xs text-gray-500">Average rating</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{(reviews ?? []).length}</p>
          <p className="text-sm text-gray-600 mt-1">Total reviews</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{responded}</p>
          <p className="text-sm text-gray-600 mt-1">Responded</p>
        </div>
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Reviews</h2>
        </div>
        {(reviews ?? []).length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No reviews tracked yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(reviews ?? []).map((review: ReviewRow) => (
              <div key={review.id} className="px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-600">
                          {review.reviewer_name?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{review.reviewer_name ?? 'Anonymous'}</p>
                        <div className="flex items-center gap-2">
                          {review.rating && <StarRating rating={review.rating} />}
                          <span className="text-xs text-gray-400">{format(new Date(review.created_at), 'dd MMM yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    {review.review_text && (
                      <p className="text-sm text-gray-600 italic mb-3 leading-relaxed">
                        &ldquo;{review.review_text}&rdquo;
                      </p>
                    )}
                    {review.response_draft && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">
                          {review.posted ? 'Response posted:' : 'Draft response:'}
                        </p>
                        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                          {review.response_draft}
                        </div>
                      </div>
                    )}
                  </div>
                  <ReviewActions review={review} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

type ReviewRow = {
  id: string;
  reviewer_name: string | null;
  review_text: string | null;
  rating: number | null;
  response_draft: string | null;
  posted: boolean;
  created_at: string;
};

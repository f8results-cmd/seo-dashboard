'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Client, Job, Score, GbpPost, ReviewResponse, RankTracking } from '@/lib/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const PIPELINE_AGENTS = [
  'research_agent', 'content_agent', 'design_agent', 'deploy_agent',
  'suburb_agent', 'gbp_agent', 'citation_agent', 'report_agent',
];

const AGENT_LABELS: Record<string, string> = {
  research_agent: 'Research',
  content_agent: 'Content',
  design_agent: 'Design',
  deploy_agent: 'Deploy',
  suburb_agent: 'Suburb Pages',
  gbp_agent: 'Google Business Profile',
  citation_agent: 'Citations',
  report_agent: 'Report',
};

const AU_DIRECTORIES = [
  { name: 'Google Business Profile', url: 'https://business.google.com', priority: 'essential' },
  { name: 'Bing Places for Business', url: 'https://www.bingplaces.com', priority: 'high' },
  { name: 'Apple Maps Connect', url: 'https://mapsconnect.apple.com', priority: 'high' },
  { name: 'Facebook Business', url: 'https://www.facebook.com/business', priority: 'high' },
  { name: 'True Local', url: 'https://www.truelocal.com.au', priority: 'high' },
  { name: 'Yellow Pages AU', url: 'https://www.yellowpages.com.au', priority: 'high' },
  { name: 'White Pages AU', url: 'https://www.whitepages.com.au', priority: 'high' },
  { name: 'Local Search', url: 'https://www.localsearch.com.au', priority: 'medium' },
  { name: 'Yelp Australia', url: 'https://www.yelp.com.au', priority: 'medium' },
  { name: 'Hotfrog Australia', url: 'https://www.hotfrog.com.au', priority: 'medium' },
  { name: 'Word of Mouth (WOMO)', url: 'https://www.womo.com.au', priority: 'medium' },
  { name: 'Aussie Web', url: 'https://www.aussieweb.com.au', priority: 'medium' },
  { name: 'Start Local', url: 'https://www.startlocal.com.au', priority: 'medium' },
  { name: 'Foursquare', url: 'https://foursquare.com/business', priority: 'low' },
  { name: 'Cylex Australia', url: 'https://www.cylex.com.au', priority: 'low' },
  { name: 'dLook', url: 'https://www.dlook.com.au', priority: 'low' },
  { name: 'True Business', url: 'https://www.truebusiness.com.au', priority: 'low' },
  { name: 'OzCities', url: 'https://www.ozcities.com.au', priority: 'low' },
  { name: 'Brownbook', url: 'https://www.brownbook.net', priority: 'low' },
  { name: 'Chamber of Commerce AU', url: 'https://www.australianchamber.com.au', priority: 'medium' },
];

const TABS = [
  { id: 'gbp', label: 'Google Business Profile' },
  { id: 'website', label: 'Website' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'citations', label: 'Citations' },
  { id: 'pipeline', label: 'Pipeline' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  client: Client;
  jobs: Job[];
  scores: Score[];
  deliverableKeys: string[];
  gbpPosts: GbpPost[];
  reviews: ReviewResponse[];
  rankings: RankTracking[];
  latestJobPerAgent: Record<string, Job>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientDetailTabs({
  client,
  jobs,
  scores,
  deliverableKeys,
  gbpPosts,
  reviews,
  rankings,
  latestJobPerAgent,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('gbp');

  return (
    <div className="flex gap-6 mt-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'gbp' && <GBPTab client={client} gbpPosts={gbpPosts} reviews={reviews} />}
        {activeTab === 'website' && <WebsiteTab client={client} />}
        {activeTab === 'rankings' && <RankingsTab rankings={rankings} />}
        {activeTab === 'citations' && <CitationsTab client={client} />}
        {activeTab === 'pipeline' && (
          <PipelineTab
            client={client}
            jobs={jobs}
            deliverableKeys={deliverableKeys}
            latestJobPerAgent={latestJobPerAgent}
          />
        )}
      </div>

      {/* Scores sidebar */}
      <ScoresSidebar scores={scores} />
    </div>
  );
}

// ─── Tab 1: GBP ──────────────────────────────────────────────────────────────

function GBPTab({ client, gbpPosts, reviews }: {
  client: Client; gbpPosts: GbpPost[]; reviews: ReviewResponse[];
}) {
  const router = useRouter();
  const websiteData = client.website_data as Record<string, unknown> | null;
  const gbpGuide = (websiteData?.gbp_guide ?? {}) as Record<string, unknown>;
  const services = (websiteData?.services ?? []) as Array<{ title?: string; meta_description?: string }>;
  const checklist = (websiteData?.checklist ?? {}) as Record<string, boolean>;

  // GBP data from guide (set by gbp_agent) or fallback from website_data
  const primaryCategory = gbpGuide.primary_category as string | undefined;
  const secondaryCategories = (gbpGuide.secondary_categories ?? []) as string[];
  const description = (gbpGuide.description ?? '') as string;
  const gbpServices = (gbpGuide.services ?? services.slice(0, 10).map((s) => ({
    name: s.title ?? '', description: s.meta_description ?? '',
  }))) as Array<{ name: string; description: string }>;
  const attributes = (gbpGuide.attributes ?? []) as string[];
  const qa = (gbpGuide.qa ??
    ((websiteData?.pages as Record<string, unknown>)?.homepage as Record<string, unknown>)?.faqs ??
    []
  ) as Array<{ question: string; answer: string }>;
  const photosChecklist = (gbpGuide.photos_checklist ?? [
    'Exterior — front of business during business hours',
    'Interior — reception or main working area',
    'Team — owner and staff in uniform',
    'Work in progress — job site or service being performed',
    'Before and after — transformation shots',
    'Logo and signage',
    'Vehicles with branding',
    'Completed work — portfolio examples',
  ]) as string[];

  async function markDone(key: string, done: boolean) {
    const newChecklist = { ...checklist, [key]: done };
    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website_data: { ...websiteData, checklist: newChecklist } }),
    });
    router.refresh();
  }

  async function markReviewPosted(reviewId: string) {
    await fetch(`/api/review-responses/${reviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'posted' }),
    });
    router.refresh();
  }

  const hasGuide = primaryCategory || description || gbpServices.length > 0;

  if (!hasGuide && gbpServices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-600">GBP guide not generated yet</p>
        <p className="text-xs text-gray-400 mt-1">Run the pipeline to generate the full GBP optimisation guide</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Categories */}
      {(primaryCategory || secondaryCategories.length > 0) && (
        <GBPSection title="Categories" doneKey="categories" checklist={checklist} onMarkDone={markDone}>
          {primaryCategory && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Primary Category</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-gray-50 px-3 py-2 rounded-lg font-mono">{primaryCategory}</code>
                <CopyButton text={primaryCategory} />
              </div>
            </div>
          )}
          {secondaryCategories.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Secondary Categories (add up to 9)</p>
              <div className="space-y-1.5">
                {secondaryCategories.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-gray-50 px-3 py-2 rounded-lg font-mono">{cat}</code>
                    <CopyButton text={cat} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </GBPSection>
      )}

      {/* Description */}
      {description && (
        <GBPSection title="Business Description" doneKey="description" checklist={checklist} onMarkDone={markDone}>
          <div className="flex items-start gap-2">
            <div className="flex-1 text-sm bg-gray-50 px-4 py-3 rounded-lg whitespace-pre-wrap leading-relaxed">
              {description}
            </div>
            <CopyButton text={description} />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{description.length} / 750 characters</p>
        </GBPSection>
      )}

      {/* Services */}
      {gbpServices.length > 0 && (
        <GBPSection title="Services" doneKey="services" checklist={checklist} onMarkDone={markDone}>
          <div className="space-y-3">
            {gbpServices.map((svc, i) => (
              <div key={i} className="bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{svc.name}</p>
                    {svc.description && <p className="text-sm text-gray-600 mt-0.5">{svc.description}</p>}
                  </div>
                  <CopyButton text={`${svc.name}\n${svc.description}`} />
                </div>
              </div>
            ))}
          </div>
        </GBPSection>
      )}

      {/* Attributes */}
      {attributes.length > 0 && (
        <GBPSection title="Attributes" doneKey="attributes" checklist={checklist} onMarkDone={markDone}>
          <div className="grid grid-cols-2 gap-2">
            {attributes.map((attr, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckItem
                  checked={!!checklist[`attr_${i}`]}
                  onChange={(v) => markDone(`attr_${i}`, v)}
                />
                <span className="text-gray-700">{attr}</span>
              </div>
            ))}
          </div>
        </GBPSection>
      )}

      {/* Q&A */}
      {qa.length > 0 && (
        <GBPSection title="Q&A (add to GBP)" doneKey="qa" checklist={checklist} onMarkDone={markDone}>
          <div className="space-y-3">
            {qa.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800 mb-1">Q: {item.question}</p>
                    <p className="text-sm text-gray-600">A: {item.answer}</p>
                  </div>
                  <CopyButton text={`Q: ${item.question}\nA: ${item.answer}`} />
                </div>
              </div>
            ))}
          </div>
        </GBPSection>
      )}

      {/* Photos Checklist */}
      <GBPSection title="Photos Checklist" doneKey="photos" checklist={checklist} onMarkDone={markDone}>
        <div className="space-y-2">
          {photosChecklist.map((photo, i) => (
            <div key={i} className="flex items-center gap-3">
              <CheckItem
                checked={!!checklist[`photo_${i}`]}
                onChange={(v) => markDone(`photo_${i}`, v)}
              />
              <span className="text-sm text-gray-700">{photo}</span>
            </div>
          ))}
        </div>
      </GBPSection>

      {/* Posts */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">GBP Posts ({gbpPosts.length})</h3>
        </div>
        {gbpPosts.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No posts yet — posts are created weekly by the scheduler</p>
        ) : (
          <div className="space-y-3">
            {gbpPosts.map((post) => (
              <div key={post.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <PostStatusBadge status={post.status} />
                      {(post.scheduled_date || post.created_at) && (
                        <span className="text-xs text-gray-400">
                          {format(parseISO(post.scheduled_date ?? post.created_at), 'dd MMM yyyy')}
                        </span>
                      )}
                      {post.post_type && (
                        <span className="text-xs text-gray-400 capitalize">{post.post_type}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                  </div>
                  <CopyButton text={post.content} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Review Responses</h3>
          <span className="text-xs text-gray-400">{reviews.filter(r => r.status === 'pending').length} pending</span>
        </div>
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No reviews yet</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{review.reviewer_name ?? 'Anonymous'}</p>
                    {review.rating && <StarRating rating={review.rating} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <ReviewStatusBadge status={review.status} />
                    <span className="text-xs text-gray-400">
                      {format(parseISO(review.created_at), 'dd MMM')}
                    </span>
                  </div>
                </div>
                {review.review_text && (
                  <p className="text-xs text-gray-500 italic mb-3 line-clamp-2">"{review.review_text}"</p>
                )}
                {review.draft_response && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 mb-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">Draft Response</p>
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">{review.draft_response}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  {review.draft_response && <CopyButton text={review.draft_response} label="Copy Response" />}
                  {review.status !== 'posted' && (
                    <button
                      onClick={() => markReviewPosted(review.id)}
                      className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
                    >
                      Mark Posted
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: Website ───────────────────────────────────────────────────────────

function WebsiteTab({ client }: { client: Client }) {
  const websiteData = client.website_data as Record<string, unknown> | null;
  const pages = (websiteData?.services ?? []) as Array<{ title: string; slug: string }>;
  const blogPosts = (websiteData?.blog_posts ?? []) as Array<{ title: string; slug: string; published_at?: string }>;
  const seo = (websiteData?.seo ?? {}) as Record<string, string>;
  const primaryKeyword = seo.primary_keyword;

  if (!client.live_url) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-6">
          <p className="text-sm font-medium text-amber-800">No website managed — blog posts are emailed for manual upload</p>
          <p className="text-xs text-amber-600 mt-1">Deploy the pipeline to build and host a website for this client.</p>
        </div>

        {blogPosts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Blog Posts ({blogPosts.length} generated)</h3>
            <div className="space-y-2">
              {blogPosts.map((post, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{post.title}</span>
                  {post.published_at && (
                    <span className="text-xs text-gray-400">{format(parseISO(post.published_at), 'dd MMM yyyy')}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live URL + iframe */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Live Website</h3>
          <div className="flex items-center gap-3">
            {client.github_repo && (
              <a href={`https://github.com/${client.github_repo}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
                <GithubIcon />
                GitHub Repo
              </a>
            )}
            <a href={client.live_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#1B2B6B] hover:underline">
              {client.live_url}
              <ExternalLinkIcon />
            </a>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 360 }}>
          <iframe
            src={client.live_url}
            className="w-full h-full"
            title={`${client.business_name} website`}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>

      {/* SEO Info */}
      {primaryKeyword && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Target Keywords</h3>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-navy-50 text-navy-500 text-sm rounded-full font-medium">{primaryKeyword}</span>
          </div>
          {seo.meta_description && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">Meta Description</p>
              <p className="text-sm text-gray-700">{seo.meta_description}</p>
            </div>
          )}
        </div>
      )}

      {/* Pages */}
      {pages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Service Pages ({pages.length})</h3>
          <div className="space-y-2">
            {pages.map((page, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700 flex-1">{page.title}</span>
                {page.slug && (
                  <a href={`${client.live_url}/services/${page.slug}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[#1B2B6B] hover:underline flex items-center gap-1">
                    /services/{page.slug} <ExternalLinkIcon />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blog Posts */}
      {blogPosts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Blog Posts ({blogPosts.length})</h3>
          <div className="space-y-2">
            {blogPosts.map((post, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{post.title}</span>
                {post.published_at && (
                  <span className="text-xs text-gray-400">{format(parseISO(post.published_at), 'dd MMM yyyy')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Rankings ─────────────────────────────────────────────────────────

function RankingsTab({ rankings }: { rankings: RankTracking[] }) {
  // Group by keyword, get current + previous
  const byKeyword: Record<string, RankTracking[]> = {};
  for (const r of rankings) {
    if (!byKeyword[r.keyword]) byKeyword[r.keyword] = [];
    byKeyword[r.keyword].push(r);
  }

  const rows = Object.entries(byKeyword).map(([keyword, entries]) => ({
    keyword,
    current: entries[0],
    previous: entries[1] ?? null,
  }));

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <p className="text-sm font-medium text-gray-500">No ranking data yet</p>
        <p className="text-xs text-gray-400 mt-1">Rankings will appear after the first Monday rank check</p>
      </div>
    );
  }

  const avgPosition = rows.reduce((sum, r) => sum + (r.current.position ?? 0), 0) / rows.length;
  const localPackCount = rows.filter(r => r.current.local_pack).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Keywords Tracked" value={rows.length.toString()} />
        <StatCard label="Avg Position" value={avgPosition > 0 ? avgPosition.toFixed(1) : '—'} />
        <StatCard label="In Local Pack" value={`${localPackCount} / ${rows.length}`} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">Keyword</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Position</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Change</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Local Pack</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(({ keyword, current, previous }) => {
              const pos = current.position;
              const prevPos = previous?.position ?? null;
              const delta = pos != null && prevPos != null ? prevPos - pos : null;
              return (
                <tr key={keyword} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">{keyword}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-base ${pos == null ? 'text-gray-400' : pos <= 3 ? 'text-green-600' : pos <= 10 ? 'text-yellow-600' : 'text-gray-600'}`}>
                      {pos ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {delta == null ? (
                      <span className="text-gray-400">→</span>
                    ) : delta > 0 ? (
                      <span className="text-green-600 font-medium">▲ {delta}</span>
                    ) : delta < 0 ? (
                      <span className="text-red-500 font-medium">▼ {Math.abs(delta)}</span>
                    ) : (
                      <span className="text-gray-400">→</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {current.local_pack ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Yes</span>
                    ) : (
                      <span className="text-xs text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-gray-400">
                    {format(parseISO(current.checked_at), 'dd MMM')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 4: Citations ─────────────────────────────────────────────────────────

function CitationsTab({ client }: { client: Client }) {
  const router = useRouter();
  const websiteData = client.website_data as Record<string, unknown> | null;
  const citations = (websiteData?.citations ?? {}) as Record<string, { status: string; url?: string }>;

  const nap = [
    { label: 'Business Name', value: client.business_name },
    { label: 'Address', value: [client.address, client.city, client.state, 'Australia'].filter(Boolean).join(', ') },
    { label: 'Phone', value: client.phone ?? '' },
    { label: 'Website', value: client.live_url ?? client.website_url ?? '' },
    { label: 'Email', value: client.email },
  ].filter(f => f.value);

  const napText = nap.map(f => `${f.label}: ${f.value}`).join('\n');

  async function markCitation(dirName: string, status: string, url?: string) {
    const updated = { ...citations, [dirName]: { status, url } };
    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website_data: { ...websiteData, citations: updated } }),
    });
    router.refresh();
  }

  const submitted = AU_DIRECTORIES.filter(d => citations[d.name]?.status === 'submitted').length;
  const citationScore = Math.round((submitted / AU_DIRECTORIES.length) * 100);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Submitted" value={`${submitted} / ${AU_DIRECTORIES.length}`} />
        <StatCard label="Citation Score" value={`${citationScore}%`} />
        <StatCard label="Remaining" value={(AU_DIRECTORIES.length - submitted).toString()} />
      </div>

      {/* NAP Details */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">NAP Details — Copy for each directory</h3>
          <CopyButton text={napText} label="Copy All" />
        </div>
        <div className="space-y-2">
          {nap.map((field) => (
            <div key={field.label} className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500 w-28 flex-shrink-0">{field.label}</span>
              <span className="text-sm text-gray-800 flex-1 font-mono bg-gray-50 px-3 py-1.5 rounded-lg">{field.value}</span>
              <CopyButton text={field.value} />
            </div>
          ))}
        </div>
      </div>

      {/* Directories list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">Directory</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Listing URL</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {AU_DIRECTORIES.map((dir) => {
              const citation = citations[dir.name];
              const status = citation?.status ?? 'not_submitted';
              return (
                <tr key={dir.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <a href={dir.url} target="_blank" rel="noopener noreferrer"
                        className="font-medium text-gray-800 hover:text-[#1B2B6B] transition-colors">
                        {dir.name}
                      </a>
                      {dir.priority === 'essential' && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">Essential</span>
                      )}
                      {dir.priority === 'high' && (
                        <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded font-medium">High</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <CitationStatusBadge status={status} />
                  </td>
                  <td className="px-5 py-3">
                    {citation?.url ? (
                      <a href={citation.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#1B2B6B] hover:underline flex items-center gap-1">
                        View listing <ExternalLinkIcon />
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {status !== 'submitted' && (
                        <button
                          onClick={() => markCitation(dir.name, 'submitted')}
                          className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
                        >
                          Mark Submitted
                        </button>
                      )}
                      {status !== 'pending' && status !== 'submitted' && (
                        <button
                          onClick={() => markCitation(dir.name, 'pending')}
                          className="text-xs px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors font-medium"
                        >
                          In Progress
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 text-center px-4">
        Integrate Leads Snap for automated citation management and tracking.
      </p>
    </div>
  );
}

// ─── Tab 5: Pipeline ─────────────────────────────────────────────────────────

function PipelineTab({ client, jobs, deliverableKeys, latestJobPerAgent }: {
  client: Client; jobs: Job[]; deliverableKeys: string[]; latestJobPerAgent: Record<string, Job>;
}) {
  const [retrying, setRetrying] = useState<string | null>(null);
  const router = useRouter();

  async function retryAgent(agentName: string) {
    setRetrying(agentName);
    const url = process.env.NEXT_PUBLIC_RAILWAY_URL;
    if (!url) { setRetrying(null); return; }
    try {
      await fetch(`${url}/retry/${client.id}`, { method: 'POST' });
    } catch {}
    setRetrying(null);
    router.refresh();
  }

  const deliverableSet = new Set(deliverableKeys);

  return (
    <div className="space-y-4">
      {/* Agent Status */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Agent Status</h3>
        <div className="space-y-1">
          {PIPELINE_AGENTS.map((agentName) => {
            const job = latestJobPerAgent[agentName];
            const hasCachedOutput = deliverableSet.has(`_output:${agentName}`);
            const effectiveStatus = job?.status ?? 'pending';

            // Duration
            let duration: string | null = null;
            if (job?.started_at && job?.completed_at) {
              const secs = Math.round(
                (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000
              );
              duration = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
            }

            return (
              <div key={agentName} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                <AgentStatusIcon status={effectiveStatus} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{AGENT_LABELS[agentName]}</span>
                    {hasCachedOutput && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">cached</span>
                    )}
                  </div>
                  {job?.log && effectiveStatus === 'error' && (
                    <p className="text-xs text-red-500 mt-0.5 line-clamp-2">{job.log}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {duration && <span className="text-xs text-gray-400">{duration}</span>}
                  {job?.completed_at && (
                    <span className="text-xs text-gray-400">
                      {format(parseISO(job.completed_at), 'dd MMM HH:mm')}
                    </span>
                  )}
                  <JobStatusBadge status={effectiveStatus} />
                  {effectiveStatus === 'error' && (
                    <button
                      onClick={() => retryAgent(agentName)}
                      disabled={retrying === agentName}
                      className="text-xs px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium disabled:opacity-60"
                    >
                      {retrying === agentName ? '...' : 'Retry'}
                    </button>
                  )}
                  {!job && <span className="text-xs text-gray-400">Not started</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Job History */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Job History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-4 font-medium text-gray-500">Agent</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-500">Started</th>
                <th className="text-left py-2 font-medium text-gray-500">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.slice(0, 20).map((job) => (
                <tr key={job.id}>
                  <td className="py-2 pr-4 text-gray-800">{AGENT_LABELS[job.agent_name] ?? job.agent_name}</td>
                  <td className="py-2 pr-4"><JobStatusBadge status={job.status} /></td>
                  <td className="py-2 pr-4 text-gray-500 text-xs">
                    {job.started_at ? format(parseISO(job.started_at), 'dd MMM HH:mm') : '—'}
                  </td>
                  <td className="py-2 text-gray-500 text-xs">
                    {job.completed_at ? format(parseISO(job.completed_at), 'dd MMM HH:mm') : '—'}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-sm">No jobs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Scores Sidebar ───────────────────────────────────────────────────────────

function ScoresSidebar({ scores }: { scores: Score[] }) {
  const latest = scores[0];

  const chartData = scores
    .slice()
    .reverse()
    .map((s) => ({
      date: format(parseISO(s.recorded_at), 'dd MMM'),
      Local: s.local_seo_score,
      Onsite: s.onsite_seo_score,
      Geo: s.geo_score,
    }));

  return (
    <div className="w-72 flex-shrink-0 space-y-4">
      {/* Score cards */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">SEO Scores</h3>
          {latest && (
            <span className="text-xs text-gray-400">
              {format(parseISO(latest.recorded_at), 'dd MMM')}
            </span>
          )}
        </div>

        {!latest ? (
          <p className="text-sm text-gray-400 text-center py-4">No scores yet</p>
        ) : (
          <div className="space-y-3">
            <ScoreBar label="Local SEO" value={latest.local_seo_score} color="#1B2B6B" />
            <ScoreBar label="Onsite SEO" value={latest.onsite_seo_score} color="#E8622A" />
            <ScoreBar label="GEO" value={latest.geo_score} color="#10B981" />
          </div>
        )}
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Score Trends</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#D1D5DB" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#D1D5DB" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <Line type="monotone" dataKey="Local" stroke="#1B2B6B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Onsite" stroke="#E8622A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Geo" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Score history */}
      {scores.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Score History</h3>
          <div className="space-y-2">
            {scores.slice(0, 6).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{format(parseISO(s.recorded_at), 'dd MMM yyyy')}</span>
                <div className="flex gap-2">
                  <span className="font-medium text-navy-500">{s.local_seo_score}</span>
                  <span className="text-gray-300">/</span>
                  <span className="font-medium text-orange-DEFAULT">{s.onsite_seo_score}</span>
                  <span className="text-gray-300">/</span>
                  <span className="font-medium text-green-600">{s.geo_score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Sub-Components ────────────────────────────────────────────────────

function GBPSection({ title, doneKey, checklist, onMarkDone, children }: {
  title: string; doneKey: string; checklist: Record<string, boolean>;
  onMarkDone: (key: string, done: boolean) => void; children: React.ReactNode;
}) {
  const isDone = !!checklist[`section_${doneKey}`];
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-6 ${isDone ? 'border-green-200' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <button
          onClick={() => onMarkDone(`section_${doneKey}`, !isDone)}
          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            isDone
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {isDone ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Done
            </>
          ) : (
            'Mark Done'
          )}
        </button>
      </div>
      {children}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [text]);

  return (
    <button
      onClick={copy}
      className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
        copied
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          {label ?? 'Copy'}
        </>
      )}
    </button>
  );
}

function CheckItem({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
        checked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
    </button>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 mt-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} className={`w-3 h-3 ${star <= rating ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Badge Components ─────────────────────────────────────────────────────────

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    running: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function PostStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    posted: 'bg-green-100 text-green-700',
    scheduled: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    posted: 'bg-green-100 text-green-700',
    approved: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function CitationStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    not_submitted: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<string, string> = {
    submitted: 'Submitted',
    pending: 'In Progress',
    not_submitted: 'Not submitted',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

function AgentStatusIcon({ status }: { status?: string }) {
  if (status === 'complete') return <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />;
  if (status === 'error') return <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />;
  if (status === 'running') return <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />;
  return <div className="w-2.5 h-2.5 rounded-full bg-gray-200 flex-shrink-0" />;
}

// ─── Icon Components ──────────────────────────────────────────────────────────

function ExternalLinkIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}


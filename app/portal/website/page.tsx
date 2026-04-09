import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function WebsitePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/portal');

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, live_url, website_data, github_repo')
    .eq('email', user.email ?? '')
    .single();

  if (!client) redirect('/portal');

  const websiteData = client.website_data as WebsiteData | null;
  const pages: Page[] = websiteData?.pages ?? [];
  const blogPosts: BlogPost[] = websiteData?.blog_posts ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Website</h1>
      </div>

      {!client.live_url ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Website Coming Soon</h2>
          <p className="text-sm text-gray-500">Your website is being built. We&apos;ll notify you when it&apos;s live.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Live URL banner */}
          <div className="bg-navy-500 text-white rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-navy-200 mb-1">Live URL</p>
              <a href={client.live_url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold hover:underline">
                {client.live_url}
              </a>
            </div>
            <a
              href={client.live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Open Site
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>

          {/* iFrame Preview */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-gray-100 rounded px-3 py-1 text-xs text-gray-500 truncate">
                {client.live_url}
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 480 }}>
              <iframe
                src={client.live_url}
                className="w-full h-full"
                title={`${client.business_name} website`}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>

          {/* Pages */}
          {pages.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Pages</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {pages.map((page) => (
                  <div key={page.slug} className="flex items-center justify-between px-6 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{page.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">/{page.slug}</p>
                    </div>
                    <a
                      href={`${client.live_url}/${page.slug === 'home' ? '' : page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-navy-500 hover:underline"
                    >
                      Visit
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blog Posts */}
          {blogPosts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Blog Posts</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {blogPosts.map((post, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{post.title}</p>
                      {post.published_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Published {format(new Date(post.published_at), 'dd MMM yyyy')}
                        </p>
                      )}
                    </div>
                    {post.slug && (
                      <a
                        href={`${client.live_url}/blog/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-navy-500 hover:underline"
                      >
                        Read
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Page = { title: string; slug: string };
type BlogPost = { title: string; slug?: string; published_at?: string };
type WebsiteData = { pages?: Page[]; blog_posts?: BlogPost[] };

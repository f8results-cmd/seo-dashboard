'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { Client, GbpPost } from '@/lib/types';

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 border border-gray-200 rounded shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function GuideSection({
  title, children, badge, defaultOpen = true,
}: {
  title: string; children: React.ReactNode; badge?: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
          {badge}
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

// ── Group services by closest GBP category ───────────────────────────────────

type ServiceItem = { name: string; description: string };

function groupServicesByCategory(
  services: ServiceItem[],
  categories: string[],
): Array<{ category: string; services: ServiceItem[] }> {
  if (categories.length === 0) return services.length > 0 ? [{ category: '', services }] : [];

  const stopWords = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'on', 'of', 'for', 'to', 'with', 'by']);

  function keywords(str: string): Set<string> {
    return new Set(
      str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w))
    );
  }

  const catKeywords = categories.map(cat => ({ cat, words: keywords(cat) }));
  const groups = new Map<string, ServiceItem[]>();
  categories.forEach(cat => groups.set(cat, []));
  groups.set('__other__', []);

  for (const svc of services) {
    const svcWords = keywords(svc.name + ' ' + svc.description);
    let bestCat = '__other__';
    let bestScore = 0;
    for (const { cat, words } of catKeywords) {
      let score = 0;
      words.forEach(w => { if (svcWords.has(w)) score++; });
      if (score > bestScore) { bestScore = score; bestCat = cat; }
    }
    groups.get(bestCat)!.push(svc);
  }

  const result: Array<{ category: string; services: ServiceItem[] }> = [];
  for (const cat of categories) {
    const svcs = groups.get(cat) ?? [];
    if (svcs.length > 0) result.push({ category: cat, services: svcs });
  }
  const others = groups.get('__other__') ?? [];
  if (others.length > 0) result.push({ category: 'Other Services', services: others });
  return result;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GBPSetupGuide({ client }: { client: Client }) {
  const [posts, setPosts] = useState<GbpPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/gbp-posts/${client.id}`)
      .then(r => r.json())
      .then((data: GbpPost[]) => {
        // Only show scheduled_52 posts, sorted by date
        const scheduled = (data ?? [])
          .filter(p => p.post_type === 'scheduled_52')
          .sort((a, b) =>
            (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? '')
          );
        setPosts(scheduled);
      })
      .catch(() => {})
      .finally(() => setPostsLoading(false));
  }, [client.id]);

  const wd = (client.website_data ?? {}) as Record<string, unknown>;
  const gbpGuide = (wd.gbp_guide ?? {}) as Record<string, unknown>;

  // ── Data sources ──────────────────────────────────────────────────────
  const primary = typeof client.gbp_primary_category === 'string' ? client.gbp_primary_category : String(client.gbp_primary_category ?? '');
  const secondaries: string[] = (client.gbp_secondary_categories ?? []).map(cat =>
    typeof cat === 'string' ? cat : String((cat as unknown as Record<string, unknown>)?.name ?? JSON.stringify(cat))
  );
  // Canonical description path: website_data.gbp_description (written by GBPAgent).
  // Fall back to gbp_guide.description for records where the old path is the only one populated.
  const description: string =
    (wd.gbp_description as string) || (gbpGuide.description as string) || '';
  const suburbs: string[] = client.target_suburbs ?? [];

  // GBP services list from pipeline output (website_data.gbp_services, written by GBPAgent)
  const gbpServices = (wd.gbp_services as Array<{ name: string; description: string }>) ?? [];

  // Group services under their closest GBP category heading using keyword overlap
  const allCategories = [primary, ...secondaries].filter(Boolean);
  const serviceGroups = groupServicesByCategory(gbpServices, allCategories);

  const noCategoryData = !primary && secondaries.length === 0;
  const noDescription = !description;

  // ── Helpers ───────────────────────────────────────────────────────────

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      <p className="text-xs text-gray-500">
        Read-only view of pipeline output. Use the copy buttons to paste into Google Business Profile.
        Refresh the page after a pipeline run to see updated data.
      </p>

      {/* ── 1: Categories ─────────────────────────────────────────────── */}
      <GuideSection
        title="1. GBP Categories"
        badge={
          noCategoryData
            ? <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Not set</span>
            : <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">{1 + secondaries.length} categories</span>
        }
      >
        {noCategoryData ? (
          <p className="text-sm text-gray-400">No categories set yet. Fill in Starter Info and run the pipeline.</p>
        ) : (
          <div className="space-y-2">
            {primary && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16 shrink-0">Primary</span>
                <span className="flex-1 text-sm font-medium text-gray-900 bg-blue-50 border border-blue-100 rounded px-3 py-1.5">{String(primary)}</span>
                <CopyBtn text={String(primary)} />
              </div>
            )}
            {secondaries.map((cat, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16 shrink-0">Secondary {i + 1}</span>
                <span className="flex-1 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded px-3 py-1.5">{String(cat)}</span>
                <CopyBtn text={String(cat)} />
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <CopyBtn
                text={[primary, ...secondaries].filter(Boolean).join('\n')}
                label="Copy all"
              />
            </div>
          </div>
        )}
      </GuideSection>

      {/* ── 2: Business Description ───────────────────────────────────── */}
      <GuideSection
        title="2. Business Description"
        badge={
          description
            ? <span className={`text-xs px-2 py-0.5 rounded-full border ${description.length > 750 ? 'text-red-600 bg-red-50 border-red-200' : 'text-green-700 bg-green-50 border-green-200'}`}>
                {description.length} / 750 chars
              </span>
            : <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Not generated</span>
        }
      >
        {noDescription ? (
          <p className="text-sm text-gray-400">No description yet. Run the pipeline to generate one.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
              {description}
            </p>
            {description.length > 750 && (
              <p className="text-xs text-red-600 font-medium">
                ⚠ {description.length - 750} chars over limit — re-run pipeline to regenerate
              </p>
            )}
            <div className="flex justify-end">
              <CopyBtn text={description} label="Copy description" />
            </div>
          </div>
        )}
      </GuideSection>

      {/* ── 3: GBP Services (pipeline output) ────────────────────────── */}
      <GuideSection
        title={gbpServices.length > 0 ? `3. GBP Services (${gbpServices.length})` : '3. GBP Services'}
        badge={
          gbpServices.length > 0
            ? <span className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">paste into GBP</span>
            : <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Not generated</span>
        }
        defaultOpen={gbpServices.length > 0}
      >
        {gbpServices.length === 0 ? (
          <p className="text-sm text-gray-400">No GBP services yet. Run the pipeline to generate them.</p>
        ) : (
          <div className="space-y-4">
            {serviceGroups.map((group, gi) => (
              <div key={gi}>
                {group.category && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{String(group.category)}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                <div className="space-y-2">
                  {group.services.map((svc, i) => (
                    <div key={i} className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{svc.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{svc.description}</p>
                      </div>
                      <CopyBtn text={`${svc.name}\n${svc.description}`} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <CopyBtn
                text={gbpServices.map(s => `${s.name}\n${s.description}`).join('\n\n')}
                label="Copy all"
              />
            </div>
          </div>
        )}
      </GuideSection>

      {/* ── 4: Target Suburbs ─────────────────────────────────────────── */}
      <GuideSection
        title="4. Target Suburbs"
        badge={
          suburbs.length > 0
            ? <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">{suburbs.length} suburbs</span>
            : <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Not set</span>
        }
      >
        {suburbs.length === 0 ? (
          <p className="text-sm text-gray-400">No target suburbs entered. Fill in the Starter Info tab.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {suburbs.map(s => (
                <span key={s} className="text-xs bg-[#1a2744] text-white px-2.5 py-1 rounded-full">{s}</span>
              ))}
            </div>
            <div className="flex justify-end">
              <CopyBtn text={suburbs.join(', ')} label="Copy suburbs" />
            </div>
          </div>
        )}
      </GuideSection>

      {/* ── 5: Posts Schedule ─────────────────────────────────────────── */}
      <GuideSection
        title={`5. GBP Posts Schedule (${postsLoading ? '…' : posts.length})`}
        badge={
          !postsLoading && posts.length > 0
            ? <span className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{posts.length} posts</span>
            : null
        }
        defaultOpen={false}
      >
        {postsLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-400">No scheduled posts yet. Run the pipeline to generate 52 posts.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {posts.map((post, i) => (
              <div key={post.id} className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-lg p-3">
                <div className="text-xs text-gray-400 shrink-0 w-8 pt-0.5 text-right font-mono">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-1">{formatDate(post.scheduled_date)}</p>
                  <p className="text-sm text-gray-800 leading-relaxed line-clamp-3">{post.content}</p>
                </div>
                <CopyBtn text={post.content} />
              </div>
            ))}
          </div>
        )}
      </GuideSection>
    </div>
  );
}

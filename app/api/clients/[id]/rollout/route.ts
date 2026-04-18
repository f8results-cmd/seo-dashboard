import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function supabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// ── Week generation helpers ───────────────────────────────────────────────────

/** Return the Friday on or after a given date. */
function nextFriday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun, 5=Fri
  const daysUntilFriday = dow <= 5 ? 5 - dow : 7 - dow + 5;
  d.setDate(d.getDate() + daysUntilFriday);
  return d;
}

/** Return the Monday after a given Friday. */
function mondayAfter(friday: Date): Date {
  const d = new Date(friday);
  d.setDate(d.getDate() + 3); // Fri → Mon
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface WeekTemplate {
  week_number: number;
  week_label: string;
  phase: string;
  items: { item_key: string; label: string; category: string; sort_order: number }[];
}

function buildWeekTemplates(managesWebsite: boolean, canMakeChanges: boolean): WeekTemplate[] {
  const gbpItems = [
    { item_key: 'gbp_categories',    label: 'Set primary + secondary GBP categories (use GBP Setup tab)', category: 'GBP', sort_order: 1 },
    { item_key: 'gbp_description',   label: 'Update GBP business description (copy from GBP Setup tab)',  category: 'GBP', sort_order: 2 },
    { item_key: 'gbp_services',      label: 'Add all 30 GBP services (from GBP Setup tab)',               category: 'GBP', sort_order: 3 },
    { item_key: 'gbp_hours',         label: 'Set business hours in GBP',                                  category: 'GBP', sort_order: 4 },
    { item_key: 'gbp_logo',          label: 'Upload logo photo to GBP (250×250px min)',                   category: 'GBP', sort_order: 5 },
    { item_key: 'gbp_cover',         label: 'Upload cover photo to GBP (1080×608px)',                     category: 'GBP', sort_order: 6 },
    { item_key: 'gbp_photos_10',     label: 'Upload 10+ business photos to GBP',                          category: 'GBP', sort_order: 7 },
    { item_key: 'gbp_ghl',           label: 'Connect GBP to GHL sub-account for auto posting',            category: 'GBP', sort_order: 8 },
    { item_key: 'gbp_posts_check',   label: 'Verify 52 GBP posts are scheduled in GHL Social Planner',    category: 'GBP', sort_order: 9 },
    { item_key: 'client_gbp_guide',  label: 'Send GBP setup guide email to client',                       category: 'Client', sort_order: 10 },
    { item_key: 'client_welcome',    label: 'Send welcome email to client',                                category: 'Client', sort_order: 11 },
  ];

  const websiteFullItems = [
    { item_key: 'website_review',    label: 'Review live website — all pages load, no broken links',      category: 'Website', sort_order: 1 },
    { item_key: 'website_titles',    label: 'Verify title tags on homepage and all service pages',         category: 'Website', sort_order: 2 },
    { item_key: 'website_mobile',    label: 'Test mobile — phone number clickable, layout correct',        category: 'Website', sort_order: 3 },
    { item_key: 'website_sitemap',   label: 'Submit sitemap to Google Search Console',                     category: 'Website', sort_order: 4 },
    { item_key: 'website_schema',    label: 'Verify LocalBusiness schema via Rich Results Test',           category: 'Website', sort_order: 5 },
    { item_key: 'seo_category_pages', label: 'Confirm all secondary category pages are live',              category: 'SEO',     sort_order: 6 },
    { item_key: 'seo_suburb_pages',   label: 'Review suburb pages — accurate local content',               category: 'SEO',     sort_order: 7 },
    { item_key: 'seo_internal_links', label: 'Verify internal linking between pages',                      category: 'SEO',     sort_order: 8 },
    { item_key: 'gsc_submit',         label: 'Request indexing for homepage in Google Search Console',     category: 'SEO',     sort_order: 9 },
  ];

  const websiteOnpageItems = canMakeChanges
    ? [
        { item_key: 'onpage_review_existing', label: 'Review existing website in browser (all main pages)', category: 'Website', sort_order: 1 },
        { item_key: 'onpage_title_tags',    label: 'Apply recommended title tags (check Notes for CMS login)',  category: 'Website', sort_order: 2 },
        { item_key: 'onpage_h1_h2',         label: 'Update H1 + H2 headings on main pages (check Notes for CMS login)', category: 'Website', sort_order: 3 },
        { item_key: 'onpage_nap_block',     label: 'Insert NAP block on homepage + contact page (check Notes for CMS login)', category: 'Website', sort_order: 4 },
        { item_key: 'onpage_mobile_check',  label: 'Check phone number is clickable on mobile after changes', category: 'Website', sort_order: 5 },
        { item_key: 'onpage_gsc_resubmit',  label: 'Re-request indexing in Google Search Console',            category: 'SEO',     sort_order: 6 },
      ]
    : [
        { item_key: 'onpage_review_existing', label: 'Review existing website — note title tags, H1, H2, NAP', category: 'Website', sort_order: 1 },
        { item_key: 'onpage_report_draft',   label: 'Prepare on-page SEO report for webmaster',                category: 'Website', sort_order: 2 },
        { item_key: 'onpage_send_report',    label: 'Send on-page SEO recommendations email to webmaster contact', category: 'Website', sort_order: 3 },
        { item_key: 'onpage_followup',       label: 'Note whether webmaster confirmed receipt',                category: 'Website', sort_order: 4 },
      ];

  const citationsItems = [
    { item_key: 'citations_leadsnap',   label: 'Confirm LeadSnap citation subscription is active for this location', category: 'Citations', sort_order: 1 },
    { item_key: 'citations_manual',     label: 'Submit manual citations (Yellow Pages, White Pages, Yelp, Localsearch)', category: 'Citations', sort_order: 2 },
    { item_key: 'citations_nap_check',  label: 'Verify NAP consistency across all active citations',                  category: 'Citations', sort_order: 3 },
    { item_key: 'backlinks_review',     label: 'Review backlink opportunities report (Citations tab)',                 category: 'Citations', sort_order: 4 },
    { item_key: 'backlinks_top3',       label: 'Action top 3 high-priority backlink opportunities manually',          category: 'Citations', sort_order: 5 },
  ];

  const ongoingItems = [
    { item_key: 'ongoing_rank_check',   label: 'Check rank tracking (Rank Tracking tab) and note movement',  category: 'SEO',     sort_order: 1 },
    { item_key: 'ongoing_gbp_posts',    label: 'Verify GBP posts are publishing weekly via GHL',              category: 'GBP',     sort_order: 2 },
    { item_key: 'ongoing_reviews',      label: 'Respond to any new Google reviews',                           category: 'GBP',     sort_order: 3 },
    { item_key: 'ongoing_heatmap',      label: 'Review heatmap scans for keyword position changes',           category: 'SEO',     sort_order: 4 },
    { item_key: 'ongoing_report_ready', label: 'Prepare monthly report data for client',                      category: 'Client',  sort_order: 5 },
  ];

  if (managesWebsite) {
    return [
      { week_number: 1, week_label: 'Week 1: GBP Setup + Optimisation',   phase: 'gbp_setup', items: gbpItems },
      { week_number: 2, week_label: 'Week 2: Website SEO Build',           phase: 'website',   items: websiteFullItems },
      { week_number: 3, week_label: 'Week 3: Citations + Backlinks',       phase: 'citations', items: citationsItems },
      { week_number: 4, week_label: 'Week 4+: Ongoing SEO',                phase: 'ongoing',   items: ongoingItems },
    ];
  } else {
    return [
      { week_number: 1, week_label: 'Week 1: GBP Setup + Optimisation',        phase: 'gbp_setup',      items: gbpItems },
      { week_number: 2, week_label: 'Week 2: On-Page SEO Recommendations',     phase: 'website_onpage', items: websiteOnpageItems },
      { week_number: 3, week_label: 'Week 3: Citations + Backlinks',           phase: 'citations',      items: citationsItems },
      { week_number: 4, week_label: 'Week 4+: Ongoing SEO',                   phase: 'ongoing',        items: ongoingItems },
    ];
  }
}

// ── GET /api/clients/[id]/rollout ─────────────────────────────────────────────
// Returns rollout weeks + items for a client, with joined Friday updates.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sb = supabase();
  const { id } = params;

  const { data: weeks, error } = await sb
    .from('client_rollout_weeks')
    .select('*, items:client_rollout_items(*)')
    .eq('client_id', id)
    .order('week_number', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Join latest Friday update per week
  const { data: fridayUpdates } = await sb
    .from('friday_updates')
    .select('*')
    .eq('client_id', id)
    .order('sent_at', { ascending: false });

  const updatesByWeek: Record<number, unknown> = {};
  for (const fu of (fridayUpdates ?? [])) {
    const wn = (fu as Record<string, unknown>).week_number as number | null;
    if (wn && !updatesByWeek[wn]) updatesByWeek[wn] = fu;
  }

  const result = (weeks ?? []).map(w => ({
    ...w,
    items: ((w as Record<string, unknown>).items ?? []) as unknown[],
    friday_update: updatesByWeek[w.week_number] ?? null,
  }));

  return NextResponse.json({ weeks: result });
}

// ── POST /api/clients/[id]/rollout ────────────────────────────────────────────
// Initialises the rollout for a client (idempotent — skips if weeks already exist).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sb = supabase();
  const { id } = params;

  // Fetch client
  const { data: client, error: clientErr } = await sb
    .from('clients')
    .select('manages_website, can_make_changes, onboarding_date, business_name')
    .eq('id', id)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: clientErr?.message ?? 'Client not found' }, { status: 404 });
  }

  // Check if rollout already exists
  const { data: existing } = await sb
    .from('client_rollout_weeks')
    .select('id')
    .eq('client_id', id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: 'Rollout already initialised', weeks_count: existing.length });
  }

  // Determine week start date
  const startDateStr = client.onboarding_date ?? new Date().toISOString().split('T')[0];
  const startDate = new Date(startDateStr + 'T00:00:00Z');
  const week1End = nextFriday(startDate);

  const templates = buildWeekTemplates(
    client.manages_website ?? true,
    client.can_make_changes ?? false,
  );

  let weekStart = startDate;
  for (const tpl of templates) {
    const weekEnd = nextFriday(weekStart);

    const { data: weekRow, error: weekErr } = await sb
      .from('client_rollout_weeks')
      .insert({
        client_id: id,
        week_number: tpl.week_number,
        week_label: tpl.week_label,
        phase: tpl.phase,
        starts_on: isoDate(weekStart),
        ends_on: isoDate(weekEnd),
      })
      .select('id')
      .single();

    if (weekErr || !weekRow) {
      return NextResponse.json({ error: weekErr?.message ?? 'Failed to create week' }, { status: 500 });
    }

    const itemRows = tpl.items.map(item => ({
      week_id: weekRow.id,
      client_id: id,
      ...item,
    }));

    const { error: itemErr } = await sb.from('client_rollout_items').insert(itemRows);
    if (itemErr) {
      return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }

    // Advance to next week (Monday after this Friday, then find next Friday)
    weekStart = mondayAfter(weekEnd);
  }

  return NextResponse.json({ message: 'Rollout initialised', weeks_count: templates.length });
}

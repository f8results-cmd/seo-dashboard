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
  items: { item_key: string; label: string; category: string; sort_order: number; is_auto: boolean }[];
}

function buildWeekTemplates(_managesWebsite: boolean, _canMakeChanges: boolean): WeekTemplate[] {
  const week1Items = [
    // Auto items
    { item_key: 'auto_pipeline_run',      label: 'Pipeline run',                          category: 'Pipeline',  sort_order: 1,  is_auto: true },
    { item_key: 'auto_serpapi_research',  label: 'SerpAPI competitor research',            category: 'Pipeline',  sort_order: 2,  is_auto: true },
    { item_key: 'auto_backlinks_gen',     label: 'Backlink opportunities generated',       category: 'Pipeline',  sort_order: 3,  is_auto: true },
    { item_key: 'auto_seo_baseline',      label: 'SEO Health baseline recorded',           category: 'Pipeline',  sort_order: 4,  is_auto: true },
    // GBP manual
    { item_key: 'gbp_manager_access',     label: 'Get GBP manager access from owner',      category: 'GBP',       sort_order: 5,  is_auto: false },
    { item_key: 'gbp_primary_category',   label: 'Set primary GBP category',               category: 'GBP',       sort_order: 6,  is_auto: false },
    { item_key: 'gbp_secondary_cats',     label: 'Add 3-5 secondary GBP categories',        category: 'GBP',       sort_order: 7,  is_auto: false },
    { item_key: 'gbp_description',        label: 'Update business description',            category: 'GBP',       sort_order: 8,  is_auto: false },
    { item_key: 'gbp_services',           label: 'Add 15-20 services with descriptions',   category: 'GBP',       sort_order: 9,  is_auto: false },
    { item_key: 'gbp_hours',              label: 'Set business hours (all 7 days)',         category: 'GBP',       sort_order: 10, is_auto: false },
    { item_key: 'gbp_website_url',        label: 'Add website URL',                        category: 'GBP',       sort_order: 11, is_auto: false },
    { item_key: 'gbp_phone_format',       label: 'Verify phone number format',             category: 'GBP',       sort_order: 12, is_auto: false },
    { item_key: 'gbp_photos_10',          label: 'Upload 10+ photos',                      category: 'GBP',       sort_order: 13, is_auto: false },
    { item_key: 'gbp_first_post',         label: 'Publish first GBP post',                 category: 'GBP',       sort_order: 14, is_auto: false },
    // GHL manual
    { item_key: 'ghl_subaccount',         label: 'Create GHL sub-account',                 category: 'GHL',       sort_order: 15, is_auto: false },
    { item_key: 'ghl_connect_gbp',        label: 'Connect GBP to GHL',                     category: 'GHL',       sort_order: 16, is_auto: false },
    { item_key: 'ghl_location_id',        label: 'Copy ghl_location_id into Supabase',     category: 'GHL',       sort_order: 17, is_auto: false },
    { item_key: 'ghl_api_key',            label: 'Copy ghl_api_key into Supabase',         category: 'GHL',       sort_order: 18, is_auto: false },
    { item_key: 'ghl_social_planner_url', label: 'Paste GHL Social Planner URL into dashboard', category: 'GHL', sort_order: 19, is_auto: false },
    { item_key: 'ghl_posts_csv',          label: 'Upload 52 posts CSV to GHL',             category: 'GHL',       sort_order: 20, is_auto: false },
    { item_key: 'ghl_schedule_posts',     label: 'Schedule posts',                         category: 'GHL',       sort_order: 21, is_auto: false },
    // Client comms
    { item_key: 'client_welcome_email',   label: 'Send welcome email',                     category: 'Client',    sort_order: 22, is_auto: false },
    { item_key: 'client_onboarding_wkt',  label: 'Send onboarding walkthrough',            category: 'Client',    sort_order: 23, is_auto: false },
  ];

  const week2Items = [
    // Citations (auto)
    { item_key: 'auto_leadsnap',          label: 'Activate LeadSnap citation subscription', category: 'Citations', sort_order: 1, is_auto: true },
    { item_key: 'auto_dir_submissions',   label: 'Verify 50+ directory submissions started', category: 'Citations', sort_order: 2, is_auto: true },
    { item_key: 'citations_nap_check',    label: 'Check NAP consistency',                  category: 'Citations', sort_order: 3, is_auto: false },
    // Website
    { item_key: 'website_live',           label: 'Verify live website',                    category: 'Website',   sort_order: 4, is_auto: false },
    { item_key: 'website_service_pages',  label: 'Verify service pages render',            category: 'Website',   sort_order: 5, is_auto: false },
    { item_key: 'website_suburb_pages',   label: 'Verify suburb pages complete',           category: 'Website',   sort_order: 6, is_auto: false },
    { item_key: 'website_contact_form',   label: 'Test contact form → GHL webhook',        category: 'Website',   sort_order: 7, is_auto: false },
    { item_key: 'website_custom_domain',  label: 'Add custom domain (if applicable)',      category: 'Website',   sort_order: 8, is_auto: false },
    { item_key: 'website_sitemap_gsc',    label: 'Submit sitemap to Google Search Console', category: 'Website',  sort_order: 9, is_auto: false },
    // AI Editor
    { item_key: 'ai_homepage_tone',       label: 'Review homepage tone',                   category: 'AI Editor', sort_order: 10, is_auto: false },
    { item_key: 'ai_about_page',          label: 'Refine about page',                      category: 'AI Editor', sort_order: 11, is_auto: false },
    { item_key: 'ai_hero_photo',          label: 'Swap hero photo if needed',              category: 'AI Editor', sort_order: 12, is_auto: false },
    { item_key: 'ai_service_pages',       label: 'Edit service pages for brand voice',     category: 'AI Editor', sort_order: 13, is_auto: false },
  ];

  const week3Items = [
    // Reviews
    { item_key: 'reviews_templates',      label: 'Set up review request templates in GHL',          category: 'Reviews',   sort_order: 1, is_auto: false },
    { item_key: 'reviews_trigger',        label: 'Configure review request trigger (job completed)', category: 'Reviews',   sort_order: 2, is_auto: false },
    { item_key: 'reviews_test_flow',      label: 'Test review request flow',                        category: 'Reviews',   sort_order: 3, is_auto: false },
    { item_key: 'reviews_response_draft', label: 'Set up review response drafting',                 category: 'Reviews',   sort_order: 4, is_auto: false },
    // Backlinks
    { item_key: 'backlinks_local_dir',    label: 'Submit to free local directory',                  category: 'Backlinks', sort_order: 5, is_auto: false },
    { item_key: 'backlinks_chamber',      label: 'Join local chamber of commerce',                  category: 'Backlinks', sort_order: 6, is_auto: false },
    { item_key: 'backlinks_news_pitch',   label: 'Pitch local news story',                          category: 'Backlinks', sort_order: 7, is_auto: false },
    { item_key: 'backlinks_outreach_sent',label: 'Mark all 3 as Outreach Sent',                     category: 'Backlinks', sort_order: 8, is_auto: false },
  ];

  const week4Items = [
    // Measurement (auto)
    { item_key: 'auto_seo_verify',        label: 'Verify SEO Health baseline data',                    category: 'Measurement', sort_order: 1, is_auto: true },
    { item_key: 'meas_ranking_changes',   label: 'Check ranking changes vs baseline',                  category: 'Measurement', sort_order: 2, is_auto: false },
    { item_key: 'meas_top3_kw',           label: 'Identify top 3 performing keywords',                 category: 'Measurement', sort_order: 3, is_auto: false },
    { item_key: 'meas_top3_opps',         label: 'Identify top 3 improvement opportunities',           category: 'Measurement', sort_order: 4, is_auto: false },
    // Continued outreach
    { item_key: 'backlinks_3more',        label: '3 more backlink outreach attempts',                  category: 'Backlinks',   sort_order: 5, is_auto: false },
    { item_key: 'backlinks_followup',     label: 'Follow up on Week 3 non-responders',                 category: 'Backlinks',   sort_order: 6, is_auto: false },
    { item_key: 'gbp_posts_w4',           label: 'Post 2-4 GBP posts',                                category: 'GBP',         sort_order: 7, is_auto: false },
    // Client update
    { item_key: 'client_friday_update',   label: 'Send Friday update with Week 1-4 progress',          category: 'Client',      sort_order: 8, is_auto: false },
    { item_key: 'client_seo_screenshot',  label: 'Screenshot SEO Health score',                        category: 'Client',      sort_order: 9, is_auto: false },
    { item_key: 'client_month2_call',     label: 'Call to discuss month 2 focus',                      category: 'Client',      sort_order: 10, is_auto: false },
  ];

  return [
    { week_number: 1, week_label: 'Week 1: GBP Setup + Optimisation',   phase: 'gbp_setup',  items: week1Items },
    { week_number: 2, week_label: 'Week 2: Citations + Website Live',    phase: 'website',    items: week2Items },
    { week_number: 3, week_label: 'Week 3: Reviews + Backlinks Start',   phase: 'citations',  items: week3Items },
    { week_number: 4, week_label: 'Week 4: Tracking + Optimisation',     phase: 'ongoing',    items: week4Items },
  ];
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
// Initialises (or force re-initialises) the rollout for a client.
// Pass ?force=true to delete existing data and re-seed.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sb = supabase();
  const { id } = params;
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === 'true';

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
    if (!force) {
      return NextResponse.json({ message: 'Rollout already initialised', weeks_count: existing.length });
    }
    // Force re-init: delete existing weeks (cascades to items)
    await sb.from('client_rollout_weeks').delete().eq('client_id', id);
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

    // is_auto is detected at UI level via item_key prefix ('auto_') — migration 019 adds the column
    const itemRows = tpl.items.map(item => ({
      week_id:    weekRow.id,
      client_id:  id,
      item_key:   item.item_key,
      label:      item.label,
      category:   item.category,
      sort_order: item.sort_order,
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

/**
 * POST /api/generate-posts/[clientId]
 *
 * Railway-independent: generates 4 GBP posts using Claude API directly,
 * validates them inline, and saves each to approval_queue in Supabase.
 * Replaces the Railway /generate-next-month-posts/{client_id} endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';

export const maxDuration = 60;

// ── Inline post validation (mirrors tools/gbp_validation.py) ─────────────────

const PHONE_RE =
  /(?:\+61[\s-]?(?:4\d{2}[\s-]?\d{3}[\s-]?\d{3}|\d[\s-]?\d{4}[\s-]?\d{4})|0[45]\d{2}[\s-]?\d{3}[\s-]?\d{3}|0[2-9][\s-]?\d{4}[\s-]?\d{4}|(?:1300|1800)[\s-]?\d{3}[\s-]?\d{3})/;

const FORBIDDEN_CTA_RE =
  /\b(call\s+us|call\s+now|call\s+today|call\s+me|phone\s+us|ring\s+us|click\s+here)\b/i;

const DASH_RE = /[—–]/;

const URL_RE = /(https?:\/\/|www\.|\S+\.(com|net|au|org|io|co)\b)/i;

// eslint-disable-next-line no-misleading-character-class
const EMOJI_RE = new RegExp(
  '[😀-🙏🌀-🗿🚀-🛿' +
  '🇠-🇿☀-➿🤀-🧿✂-➰]',
);

function validatePost(text: string): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  if (text.length < 50) violations.push(`too short (${text.length} chars)`);
  if (text.length > 1500) violations.push(`too long (${text.length} chars)`);
  if (PHONE_RE.test(text)) violations.push('contains phone number');
  const cta = text.match(FORBIDDEN_CTA_RE);
  if (cta) violations.push(`forbidden CTA: "${cta[0]}"`);
  if (DASH_RE.test(text)) violations.push('contains em/en-dash');
  if (URL_RE.test(text)) violations.push('contains URL or domain');
  if (EMOJI_RE.test(text)) violations.push('contains emoji');
  return { valid: violations.length === 0, violations };
}

// ── Post type definitions ─────────────────────────────────────────────────────

const POST_TYPES = ['suburb_spotlight', 'service_highlight', 'before_after', 'tip_advice'] as const;

type PostType = typeof POST_TYPES[number];

function postTypeInstruction(
  type: PostType,
  suburb: string,
  service: string,
  businessName: string,
  city: string,
): string {
  switch (type) {
    case 'suburb_spotlight':
      return `Write a suburb spotlight post focused on how ${businessName} serves ${suburb}. Reference something specific about ${suburb}.`;
    case 'service_highlight':
      return `Highlight the service: "${service}". Explain what it involves and why customers in ${city} choose ${businessName}.`;
    case 'before_after':
      return `Describe a realistic before-and-after for a ${service} job in ${suburb}.`;
    case 'tip_advice':
      return `Share an expert tip about the service that ${city} residents often get wrong. Reference ${suburb} naturally.`;
  }
}

// ── Next Monday of next month (Adelaide time, UTC+9:30 / UTC+10:30 DST) ──────

function nextMonthMondays(): string[] {
  // Simple UTC+9:30 approximation (good enough for scheduling dates)
  const now = new Date(Date.now() + 9.5 * 3600 * 1000);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  // Find first Monday of next month
  const first = new Date(Date.UTC(nextYear, nextMonth, 1));
  const dayOfWeek = first.getUTCDay(); // 0=Sun, 1=Mon
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = new Date(first);
  firstMonday.setUTCDate(first.getUTCDate() + daysToMonday);

  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(firstMonday);
    d.setUTCDate(firstMonday.getUTCDate() + i * 7);
    // Set to 09:00 Adelaide (UTC+9:30 = subtract 9.5h from local to get UTC)
    d.setUTCHours(9, 30, 0, 0); // 09:30 UTC ≈ 09:00 ACST for rough scheduling
    return d.toISOString();
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const clientId = params.clientId.trim();
  const supabase = createServiceClient();

  // Fetch client
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, business_name, niche, city, state, phone, live_url, website_url, manual_services, website_data, ghl_location_id, ghl_api_key, gbp_location_name, target_suburbs')
    .eq('id', clientId)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured on server' }, { status: 503 });
  }

  const {
    business_name: businessName,
    niche,
    city,
    state,
    phone,
    live_url,
    website_url,
    manual_services,
    website_data,
    ghl_location_id,
    ghl_api_key,
    gbp_location_name,
    target_suburbs,
  } = client;

  const useGhl = Boolean(ghl_location_id && ghl_api_key);

  // Build suburb pool
  const wd = (website_data ?? {}) as Record<string, unknown>;
  const suburbPages = (wd['suburb_pages'] as { suburb_name: string }[] | undefined) ?? [];
  const suburbPool: string[] =
    (target_suburbs as string[] | null)?.length
      ? (target_suburbs as string[])
      : suburbPages.length
      ? suburbPages.map(p => p.suburb_name)
      : [city ?? 'local area', 'Norwood', 'Unley', 'Burnside', 'Prospect', 'Glenelg'];

  // Build service list
  const rawServices = (manual_services ?? '') as string;
  const serviceList: string[] = rawServices
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (!serviceList.length) {
    serviceList.push(niche ?? 'our service', `${niche} repair`, `${niche} maintenance`);
  }

  // Pick 4 suburbs and services (simple round-robin from start of pool)
  const suburbs = [0, 1, 2, 3].map(i => suburbPool[i % suburbPool.length]);
  const services = [0, 1, 2, 3].map(i => serviceList[i % serviceList.length]);
  const postTypes = POST_TYPES;
  const scheduledDates = nextMonthMondays();
  const monthName = new Date(scheduledDates[0]).toLocaleString('en-AU', { month: 'long', timeZone: 'Australia/Adelaide' });

  // Build batch prompt — one Claude call for all 4 posts
  const assignmentBlock = postTypes
    .map((t, i) => `Post ${i + 1}: type=${t.replace(/_/g, ' ')}, suburb=${suburbs[i]}, service=${services[i]}`)
    .join('\n');

  const instructionBlock = postTypes
    .map((t, i) => `Post ${i + 1} (${t.replace(/_/g, ' ')}): ${postTypeInstruction(t, suburbs[i], services[i], businessName, city ?? '')}`)
    .join('\n');

  const prompt = `Generate 4 Google Business Profile "What's New" posts for ${businessName} for ${monthName}.

Business: ${businessName} — ${niche} in ${city}${state ? ', ' + state : ''}, Australia
Services offered: ${serviceList.slice(0, 8).join(', ')}

POST ASSIGNMENTS:
${assignmentBlock}

DETAILED INSTRUCTIONS PER POST:
${instructionBlock}

RULES — every post must follow all of these exactly:
- 150-200 words each
- Each post naturally mentions its assigned suburb at least once
- Each post naturally mentions its assigned service or a related keyword
- End each post naturally with a closing sentence — do NOT include any URLs, "Visit our website", "Get a quote at...", "Visit us at", or any web address or domain name
- Sound like the business owner wrote it — warm, local, authentic
- No hashtags
- NEVER include phone numbers (GBP rejects posts with phone numbers)
- NEVER use "call us", "call now", "call today", "ring us", "phone us", or "click here"
- NEVER use em-dashes (—) or en-dashes (–) — use commas, periods, or parentheses
- NEVER include any URLs or domain names (http://, https://, www., .com, .au, etc.)
- No emojis

Return ONLY a JSON array of exactly 4 strings. No markdown, no extra text:
["post 1 text", "post 2 text", "post 3 text", "post 4 text"]`;

  // Call Claude
  let rawPosts: string[] = [];
  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    // Parse JSON array
    const clean = text.trim().replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) rawPosts = JSON.parse(match[0]);
    else rawPosts = JSON.parse(clean);
  } catch (e) {
    return NextResponse.json({ error: `Claude API error: ${String(e).slice(0, 200)}` }, { status: 500 });
  }

  if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
    return NextResponse.json({ error: 'Claude returned no posts' }, { status: 500 });
  }

  // Validate and queue each post
  const queued: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < Math.min(rawPosts.length, 4); i++) {
    const text = String(rawPosts[i] ?? '').trim();
    const { valid, violations } = validatePost(text);
    if (!valid) {
      skipped.push(`Post ${i + 1}: ${violations.join(', ')}`);
      continue;
    }

    const contentData = {
      post_text: text,
      post_type: postTypes[i],
      use_ghl: useGhl,
      ghl_location_id: ghl_location_id ?? '',
      ghl_api_key: ghl_api_key ?? '',
      location_name: gbp_location_name ?? '',
      phone: phone ?? '',
      live_url: live_url ?? website_url ?? '',
      target_suburb: suburbs[i],
      target_service: services[i],
      scheduled_for: scheduledDates[i],
    };

    const { error: insertErr } = await supabase
      .from('approval_queue')
      .insert({
        client_id: clientId,
        action_type: 'gbp_post',
        content_data: contentData,
        status: 'pending',
        scheduled_for: scheduledDates[i],
      });

    if (insertErr) {
      skipped.push(`Post ${i + 1}: DB error — ${insertErr.message}`);
    } else {
      queued.push(postTypes[i]);
    }
  }

  return NextResponse.json({
    status: 'done',
    queued: queued.length,
    skipped: skipped.length,
    skipped_reasons: skipped,
    message:
      queued.length > 0
        ? `${queued.length} post${queued.length !== 1 ? 's' : ''} queued for approval — review them in Approvals.`
        : 'All posts failed validation. Check skipped_reasons.',
  });
}

/**
 * POST /api/generate-posts/[clientId]
 *
 * Research-backed GBP post generation using Claude with web_search tool.
 * Phase 1: Claude researches local/seasonal context via web search.
 * Phase 2: Claude generates 4 posts informed by that research.
 * Validates each post (word count, suburb mention, seasonal ref, no violations).
 * Retries failed posts up to 3 times without web search.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';

export const maxDuration = 300;

// ── Australian seasons (southern hemisphere) ──────────────────────────────────

function getAusSeason(month: number): string {
  if (month === 12 || month <= 2) return 'summer';
  if (month <= 5) return 'autumn';
  if (month <= 8) return 'winter';
  return 'spring';
}

// ── Post types ────────────────────────────────────────────────────────────────

const POST_TYPES = [
  'suburb_spotlight',
  'seasonal_advice',
  'educational_tip',
  'transformation',
] as const;

type PostType = typeof POST_TYPES[number];

function postTypeInstruction(
  type: PostType,
  suburb: string,
  service: string,
  businessName: string,
  city: string,
  season: string,
): string {
  switch (type) {
    case 'suburb_spotlight':
      return `Write a suburb spotlight post about ${businessName} serving ${suburb}. Reference something genuine about ${suburb} — a real local landmark, community character, lifestyle, or what residents there value. Don't just say "${suburb} residents" — paint a specific picture.`;
    case 'seasonal_advice':
      return `Give practical ${season} advice about ${service} for residents of ${suburb} and greater ${city}. Reference real ${season} conditions in South Australia — what actually happens to vehicles/properties/etc. this time of year and why it matters.`;
    case 'educational_tip':
      return `Write an educational tip post about a common mistake or misconception ${suburb} residents have about ${service}. Explain the right approach and why it matters. Should feel like advice from an expert who genuinely cares, not a sales pitch.`;
    case 'transformation':
      return `Describe a realistic before-and-after ${service} job in ${suburb}. Paint a vivid picture of the problem (something typical for ${season} in ${city}), what was done, and the result the customer experienced. Make it feel real and specific.`;
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

const PHONE_RE =
  /(?:\+61[\s-]?(?:4\d{2}[\s-]?\d{3}[\s-]?\d{3}|\d[\s-]?\d{4}[\s-]?\d{4})|0[45]\d{2}[\s-]?\d{3}[\s-]?\d{3}|0[2-9][\s-]?\d{4}[\s-]?\d{4}|(?:1300|1800)[\s-]?\d{3}[\s-]?\d{3})/;

const FORBIDDEN_CTA_RE =
  /\b(call\s+us|call\s+now|call\s+today|call\s+me|phone\s+us|ring\s+us|click\s+here)\b/i;

const DASH_RE = /[—–]/;

const URL_RE = /(https?:\/\/|www\.|\S+\.(com|net|au|org|io|co)\b)/i;

// Month names + season words — broad enough to catch "this winter", "ahead of summer", "June heat", etc.
const SEASONAL_RE =
  /\b(summer|autumn|fall|winter|spring|season|seasonal|hot|cool|cold|warm|wet|dry|heatwave|frost|rain|rainy|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function containsEmoji(text: string): boolean {
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (
      (cp >= 0x1f600 && cp <= 0x1f64f) ||
      (cp >= 0x1f300 && cp <= 0x1f5ff) ||
      (cp >= 0x1f680 && cp <= 0x1f6ff) ||
      (cp >= 0x1f1e0 && cp <= 0x1f1ff) ||
      (cp >= 0x2600 && cp <= 0x27bf) ||
      (cp >= 0x1f900 && cp <= 0x1f9ff) ||
      (cp >= 0x2702 && cp <= 0x27b0)
    )
      return true;
  }
  return false;
}

function validatePost(
  text: string,
  suburb: string,
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const words = countWords(text);
  if (words < 100) violations.push(`too short (${words} words, need 100-300)`);
  if (words > 300) violations.push(`too long (${words} words, need 100-300)`);
  if (PHONE_RE.test(text)) violations.push('contains phone number');
  const cta = text.match(FORBIDDEN_CTA_RE);
  if (cta) violations.push(`forbidden CTA: "${cta[0]}"`);
  if (DASH_RE.test(text)) violations.push('contains em/en-dash');
  if (URL_RE.test(text)) violations.push('contains URL or domain');
  if (containsEmoji(text)) violations.push('contains emoji');
  if (!text.toLowerCase().includes(suburb.toLowerCase()))
    violations.push(`missing suburb mention: ${suburb}`);
  if (!SEASONAL_RE.test(text)) violations.push('no seasonal or month reference');
  return { valid: violations.length === 0, violations };
}

// ── Scheduling ────────────────────────────────────────────────────────────────

function nextMonthMondays(): string[] {
  const now = new Date(Date.now() + 9.5 * 3600 * 1000);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const first = new Date(Date.UTC(nextYear, nextMonth, 1));
  const dayOfWeek = first.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = new Date(first);
  firstMonday.setUTCDate(first.getUTCDate() + daysToMonday);

  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(firstMonday);
    d.setUTCDate(firstMonday.getUTCDate() + i * 7);
    d.setUTCHours(9, 30, 0, 0);
    return d.toISOString();
  });
}

// ── Agentic loop for web_search tool ─────────────────────────────────────────

async function callWithWebSearch(
  anthropic: Anthropic,
  prompt: string,
  maxTurns = 12,
): Promise<string> {
  type MsgParam = Anthropic.MessageParam;
  const messages: MsgParam[] = [{ role: 'user', content: prompt }];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search', max_uses: 5 }],
      messages,
    });

    const textContent = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    if (response.stop_reason === 'end_turn') {
      return textContent;
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      // web_search_20250305 is server-executed — pass back acknowledgements;
      // Anthropic's infrastructure injects the actual results.
      const toolResults = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map(b => ({
          type: 'tool_result' as const,
          tool_use_id: b.id,
          content: '' as string,
        }));
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // max_tokens or other stop reason — return whatever text we have
    return textContent;
  }

  throw new Error('Web search loop exceeded max turns');
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const clientId = params.clientId.trim();
  const supabase = createServiceClient();

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select(
      'id, business_name, niche, city, state, phone, live_url, website_url, manual_services, website_data, ghl_location_id, ghl_api_key, gbp_location_name, target_suburbs',
    )
    .eq('id', clientId)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured on server' },
      { status: 503 },
    );
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

  // Suburb pool
  const wd = (website_data ?? {}) as Record<string, unknown>;
  const suburbPages =
    (wd['suburb_pages'] as { suburb_name: string }[] | undefined) ?? [];
  const suburbPool: string[] =
    (target_suburbs as string[] | null)?.length
      ? (target_suburbs as string[])
      : suburbPages.length
        ? suburbPages.map(p => p.suburb_name)
        : [city ?? 'local area', 'Norwood', 'Unley', 'Burnside', 'Prospect', 'Glenelg'];

  // Service list
  const rawServices = (manual_services ?? '') as string;
  const serviceList: string[] = rawServices
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (!serviceList.length) {
    serviceList.push(niche ?? 'our service', `${niche} maintenance`, `${niche} repair`);
  }

  const suburbs = [0, 1, 2, 3].map(i => suburbPool[i % suburbPool.length]);
  const services = [0, 1, 2, 3].map(i => serviceList[i % serviceList.length]);
  const postTypes = POST_TYPES;
  const scheduledDates = nextMonthMondays();

  const firstScheduled = new Date(scheduledDates[0]);
  const monthName = firstScheduled.toLocaleString('en-AU', {
    month: 'long',
    timeZone: 'Australia/Adelaide',
  });
  const monthNum = firstScheduled.getUTCMonth() + 1;
  const season = getAusSeason(monthNum);

  // ── Build combined research + generation prompt ───────────────────────────

  const assignmentBlock = postTypes
    .map(
      (t, i) =>
        `Post ${i + 1}: ${t.replace(/_/g, ' ')}, suburb: ${suburbs[i]}, service: ${services[i]}`,
    )
    .join('\n');

  const instructionBlock = postTypes
    .map(
      (t, i) =>
        `Post ${i + 1} (${t.replace(/_/g, ' ')}): ${postTypeInstruction(t, suburbs[i], services[i], businessName, city ?? '', season)}`,
    )
    .join('\n\n');

  const prompt = `You are writing 4 Google Business Profile posts for ${businessName}, a ${niche} business based in ${city ?? ''}${state ? ', ' + state : ''}, Australia.

These posts will publish in ${monthName} (${season} in Australia).

== STEP 1: RESEARCH ==

Before writing, use web search to gather genuine local context. Search for:
1. "${suburbs[0]} ${city ?? ''}" — what is this suburb actually like? Key streets, landmarks, demographics, community character.
2. "${niche} ${season} Australia" — what are the real seasonal issues, tips, and customer concerns for this trade in Australian ${season}?
3. "${suburbs[1]} OR ${suburbs[2]} ${city ?? ''} local" — any additional local colour for the other suburbs.

Use what you find to make the posts feel researched and locally grounded, not generic.

== STEP 2: WRITE 4 POSTS ==

Business: ${businessName} (${niche}, ${city ?? ''}${state ? ', ' + state : ''}, Australia)
Publish month: ${monthName} (${season})
Services offered: ${serviceList.slice(0, 8).join(', ')}

POST ASSIGNMENTS:
${assignmentBlock}

DETAILED BRIEF PER POST:
${instructionBlock}

RULES — every post must follow all of these exactly:
- 100-300 words
- Mentions its assigned suburb at least once (naturally, not forced)
- References ${season} or ${monthName} with genuine relevance to the content
- Contains at least one specific local detail (real landmark, street, known characteristic, or seasonal condition specific to ${city ?? 'the city'})
- Sounds like a knowledgeable local expert who actually works in the area — warm, genuine, not corporate
- Ends naturally — no website URLs, "visit our website", "get a quote at", "visit us at", or any domain name
- No phone numbers
- No hashtags
- No emojis
- No em-dashes (—) or en-dashes (–) — use commas, periods, or parentheses instead
- No "call us", "call now", "call today", "ring us", "phone us", or "click here"

Return ONLY a JSON array of exactly 4 strings. No markdown fences, no explanation:
["post 1 text", "post 2 text", "post 3 text", "post 4 text"]`;

  const anthropic = new Anthropic({ apiKey });

  // ── Phase 1: Generate with web search (fallback to direct if it fails) ────

  let rawPosts: string[] = [];
  try {
    let raw: string;
    try {
      raw = await callWithWebSearch(anthropic, prompt);
    } catch {
      // Web search failed — fall back to direct call with the same rich prompt
      const fallback = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3500,
        messages: [{ role: 'user', content: prompt }],
      });
      raw = fallback.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('')
        .trim();
    }

    const clean = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
    const match = clean.match(/\[[\s\S]*\]/);
    rawPosts = match ? JSON.parse(match[0]) : JSON.parse(clean);
  } catch (e) {
    return NextResponse.json(
      { error: `Generation error: ${String(e).slice(0, 200)}` },
      { status: 500 },
    );
  }

  if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
    return NextResponse.json({ error: 'Claude returned no posts' }, { status: 500 });
  }

  // ── Phase 2: Validate all 4 ───────────────────────────────────────────────

  type PostResult = { text: string; violations: string[] };
  const results: PostResult[] = rawPosts.slice(0, 4).map((raw, i) => {
    const text = String(raw ?? '').trim();
    const { violations } = validatePost(text, suburbs[i]);
    return { text, violations };
  });

  // ── Phase 3: Retry failed posts (without web search, with explicit feedback) ──

  for (let attempt = 0; attempt < 3; attempt++) {
    const failedIdxs = results
      .map((r, i) => (r.violations.length > 0 ? i : -1))
      .filter(i => i >= 0);
    if (!failedIdxs.length) break;

    const retryPrompt = `Rewrite the following Google Business Profile post(s) for ${businessName} (${niche} in ${city ?? ''}, Australia). Fix every violation listed.

${failedIdxs
  .map(
    i => `--- POST ${i + 1} TO REWRITE ---
Type: ${postTypes[i].replace(/_/g, ' ')}
Suburb: ${suburbs[i]}
Service: ${services[i]}
Publish: ${monthName} (${season} in Australia)
Violations to fix: ${results[i].violations.join(' | ')}

Brief: ${postTypeInstruction(postTypes[i], suburbs[i], services[i], businessName, city ?? '', season)}

Current text (fix this):
${results[i].text}`,
  )
  .join('\n\n')}

RULES: 100-300 words, mention the suburb, reference ${season} or ${monthName}, no URLs/phones/emojis/dashes/CTAs.

Return ONLY a JSON object with the fixed posts keyed by their number:
{ ${failedIdxs.map(i => `"${i}": "rewritten post text"`).join(', ')} }`;

    try {
      const retryResp = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: retryPrompt }],
      });
      const retryText = retryResp.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('')
        .trim();
      const retryClean = retryText
        .replace(/^```[a-z]*\n?/, '')
        .replace(/\n?```$/, '');
      const objMatch = retryClean.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const retryData = JSON.parse(objMatch[0]) as Record<string, string>;
        for (const idx of failedIdxs) {
          const fixed = String(retryData[String(idx)] ?? '').trim();
          if (fixed) {
            const { violations } = validatePost(fixed, suburbs[idx]);
            results[idx] = { text: fixed, violations };
          }
        }
      }
    } catch {
      // ignore retry errors — save whatever passed
    }
  }

  // ── Phase 4: Insert passing posts to approval_queue ───────────────────────

  const queued: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < Math.min(results.length, 4); i++) {
    const { text, violations } = results[i];
    if (violations.length > 0) {
      skipped.push(`Post ${i + 1} (${postTypes[i]}): ${violations.join(', ')}`);
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
      season,
      month: monthName,
    };

    const { error: insertErr } = await supabase.from('approval_queue').insert({
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
        ? `${queued.length} researched post${queued.length !== 1 ? 's' : ''} queued for approval — review them in Approvals.`
        : 'All posts failed validation. Check skipped_reasons.',
  });
}

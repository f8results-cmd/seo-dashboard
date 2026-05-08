/**
 * POST /api/generate-posts/[clientId]
 *
 * Research-backed GBP post generation using Claude with web_search tool.
 * Phase 1: Claude researches local/seasonal context via web search.
 * Phase 2: Claude generates 4 posts informed by that research.
 * Validates each post (word count, suburb 2+, services 2+, no banned openings, etc.).
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
  services: string[],
  businessName: string,
  category: string,
  city: string,
  state: string,
  season: string,
  monthName: string,
): string {
  const s1 = services[0] ?? category;
  const s2 = services[1] ?? s1;
  const s3 = services[2] ?? s2;
  const loc = `${suburb}, ${city}`;

  switch (type) {
    case 'suburb_spotlight':
      return `Open with a direct hook: "[BusinessName] is a [${category}] in ${suburb}. We specialise in [service1], [service2], and [service3] for residents across ${suburb} and surrounding ${city} suburbs." Then add 1-2 sentences about something genuine and specific to ${suburb} (a real landmark, streetscape, or community character) and why it connects to needing ${s1}. Close with one sentence about ${businessName}'s coverage of ${loc}.`;

    case 'seasonal_advice':
      return `Open with: "If you're looking for a ${category} in ${suburb} ahead of ${season}, [BusinessName] offers [service1] and [service2] across ${suburb} and ${city}." Then give 2-3 sentences of practical ${season} advice about ${s1} and ${s2} — what actually happens in South Australian ${season} conditions, what ${suburb} residents should watch for, and why it matters. One sentence on ${businessName}'s qualifications or experience.`;

    case 'educational_tip':
      return `Open with: "[BusinessName] is a ${category} in ${suburb} specialising in [service1], [service2], and [service3]." Then in 2-3 sentences explain one common and practical mistake ${suburb} residents make around ${s1} or ${s2} in ${monthName} — state the right approach clearly. Keep it helpful and expert, not philosophical. Reference ${suburb} a second time naturally. Close with a confident one-liner about ${businessName}.`;

    case 'transformation':
      return `Open with: "At [BusinessName], your ${category} in ${suburb}, we recently completed a [job type] for a local resident." Describe the job: what the problem was (something realistic for ${season} in ${city}), which services were involved (${s1}, ${s2}), and the outcome. Use vivid but plain language. Mention ${suburb} a second time. Close with one sentence about ${businessName}'s work across ${city} and ${state}.`;
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

const PHONE_RE =
  /(?:\+61[\s-]?(?:4\d{2}[\s-]?\d{3}[\s-]?\d{3}|\d[\s-]?\d{4}[\s-]?\d{4})|0[45]\d{2}[\s-]?\d{3}[\s-]?\d{3}|0[2-9][\s-]?\d{4}[\s-]?\d{4}|(?:1300|1800)[\s-]?\d{3}[\s-]?\d{3})/;

const FORBIDDEN_CTA_RE =
  /\b(call\s+us|call\s+now|call\s+today|call\s+me|phone\s+us|ring\s+us|click\s+here|contact\s+us|get\s+in\s+touch|reach\s+out)\b/i;

const DASH_RE = /[—–]/;

const URL_RE = /(https?:\/\/|www\.|\S+\.(com|net|au|org|io|co)\b)/i;

// Month names + season words
const SEASONAL_RE =
  /\b(summer|autumn|fall|winter|spring|season|seasonal|hot|cool|cold|warm|wet|dry|heatwave|frost|rain|rainy|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

// Banned opening phrases — philosophical/narrative openers to avoid
const BANNED_OPENING_RE =
  /^(there is a misconception|there'?s a misconception|here is something|here'?s something|it is amazing|it'?s amazing|here is a misconception|here'?s a misconception|one thing (that|we|many)|something we (hear|see|come across)|a (common|funny|surprising) thing)/i;

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
  serviceList: string[],
  category: string,
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const words = countWords(text);

  if (words < 100) violations.push(`too short (${words} words, need 100-200)`);
  if (words > 200) violations.push(`too long (${words} words, need 100-200)`);
  if (PHONE_RE.test(text)) violations.push('contains phone number');
  const cta = text.match(FORBIDDEN_CTA_RE);
  if (cta) violations.push(`forbidden CTA: "${cta[0]}"`);
  if (DASH_RE.test(text)) violations.push('contains em/en-dash');
  if (URL_RE.test(text)) violations.push('contains URL or domain');
  if (containsEmoji(text)) violations.push('contains emoji');
  if (!SEASONAL_RE.test(text)) violations.push('no seasonal or month reference');

  // Suburb must appear 2+ times
  const suburbCount = (text.toLowerCase().match(new RegExp(suburb.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
  if (suburbCount < 2) violations.push(`suburb "${suburb}" mentioned only ${suburbCount} time(s), need 2+`);

  // At least 2 specific services from the client's list must appear
  const serviceHits = serviceList.filter(s =>
    s.length > 3 && text.toLowerCase().includes(s.toLowerCase()),
  ).length;
  if (serviceHits < 2) violations.push(`only ${serviceHits} specific service(s) named from the list, need 2+`);

  // Category/trade keyword must appear in the first sentence
  const firstSentence = (text.split(/(?<=[.!?])\s/)[0] ?? text).toLowerCase();
  const categoryWords = category.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const categoryInFirst = categoryWords.some(w => firstSentence.includes(w));
  if (!categoryInFirst && !firstSentence.includes(suburb.toLowerCase())) {
    violations.push(`category "${category}" and suburb not found together in first sentence`);
  }

  // Reject banned philosophical openings
  if (BANNED_OPENING_RE.test(text.trim())) {
    violations.push('starts with a banned philosophical/narrative opening');
  }

  return { valid: violations.length === 0, violations };
}

// ── Adelaide timezone + scheduling ────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function firstSundayUtc(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month - 1, 1));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

function adelaideOffsetMs(approxUtcMs: number): number {
  // SA: ACDT (UTC+10:30) first Sunday Oct → first Sunday Apr
  //     ACST (UTC+9:30)  first Sunday Apr → first Sunday Oct
  const y = new Date(approxUtcMs).getUTCFullYear();
  const aprSun = firstSundayUtc(y, 4);
  const octSun = firstSundayUtc(y, 10);
  const isACDT = approxUtcMs < aprSun || approxUtcMs >= octSun;
  return (isACDT ? 10.5 : 9.5) * 3600 * 1000;
}

interface PostingSchedule {
  preferred_days?: string[];
  preferred_time?: string;
}

function scheduledPostDates(schedule: PostingSchedule | null, count = 4): string[] {
  const dayName = (schedule?.preferred_days?.[0] ?? 'friday').toLowerCase().trim();
  const targetWeekday = DAY_MAP[dayName] ?? 5;

  const timeParts = (schedule?.preferred_time ?? '08:00').split(':');
  const localHour = Math.max(0, Math.min(23, parseInt(timeParts[0] ?? '8', 10)));
  const localMin  = Math.max(0, Math.min(59, parseInt(timeParts[1] ?? '0', 10)));

  const nowLocalMs = Date.now() + 9.5 * 3600 * 1000;
  const startLocal = new Date(nowLocalMs + 28 * 24 * 3600 * 1000);

  const base = new Date(
    Date.UTC(startLocal.getUTCFullYear(), startLocal.getUTCMonth(), startLocal.getUTCDate()),
  );
  while (base.getUTCDay() !== targetWeekday) base.setUTCDate(base.getUTCDate() + 1);

  return Array.from({ length: count }, (_, i) => {
    const localAsUtc = Date.UTC(
      base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i * 7,
      localHour, localMin, 0, 0,
    );
    const offsetMs = adelaideOffsetMs(localAsUtc - 9.5 * 3600 * 1000);
    return new Date(localAsUtc - offsetMs).toISOString();
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
      // web_search_20250305 is server-executed — pass back acknowledgements
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
      'id, business_name, niche, city, state, phone, live_url, website_url, manual_services, gbp_services, website_data, ghl_location_id, ghl_api_key, gbp_location_name, target_suburbs, gbp_posting_schedule',
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
    gbp_services,
    website_data,
    ghl_location_id,
    ghl_api_key,
    gbp_location_name,
    target_suburbs,
    gbp_posting_schedule,
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

  // Service list — prefer manual_services, fall back to gbp_services
  const rawManual = (manual_services ?? '') as string;
  const rawGbp = Array.isArray(gbp_services)
    ? (gbp_services as string[]).join(', ')
    : (gbp_services as string | null ?? '');
  const rawServices = rawManual || rawGbp;
  const serviceList: string[] = rawServices
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (!serviceList.length) {
    serviceList.push(niche ?? 'our service', `${niche} maintenance`, `${niche} repair`);
  }

  // Category — the primary trade keyword used in SEO hooks
  const category = (niche ?? 'local business').toLowerCase();

  const suburbs = [0, 1, 2, 3].map(i => suburbPool[i % suburbPool.length]);
  const postTypes = POST_TYPES;
  const scheduledDates = scheduledPostDates(
    (gbp_posting_schedule as PostingSchedule | null) ?? null,
  );

  const firstScheduled = new Date(scheduledDates[0]);
  const monthName = firstScheduled.toLocaleString('en-AU', {
    month: 'long',
    timeZone: 'Australia/Adelaide',
  });
  const firstScheduledAdelaide = new Date(
    firstScheduled.getTime() + adelaideOffsetMs(firstScheduled.getTime()),
  );
  const monthNum = firstScheduledAdelaide.getUTCMonth() + 1;
  const season = getAusSeason(monthNum);

  // Pick 3 services per post (rotating through the list)
  const postServices = postTypes.map((_, i) =>
    [0, 1, 2].map(j => serviceList[(i * 3 + j) % serviceList.length]),
  );

  // ── Build combined research + generation prompt ───────────────────────────

  const assignmentBlock = postTypes
    .map((t, i) =>
      `Post ${i + 1}: ${t.replace(/_/g, ' ')}, suburb: ${suburbs[i]}, services: ${postServices[i].slice(0, 3).join(', ')}`,
    )
    .join('\n');

  const instructionBlock = postTypes
    .map((t, i) =>
      `Post ${i + 1} (${t.replace(/_/g, ' ')}):\n${postTypeInstruction(t, suburbs[i], postServices[i], businessName, category, city ?? '', state ?? '', season, monthName)}`,
    )
    .join('\n\n');

  const servicesSnippet = serviceList.slice(0, 10).join(', ');

  const prompt = `You are writing 4 Google Business Profile posts for ${businessName}, a ${category} based in ${city ?? ''}${state ? ', ' + state : ''}, Australia.

These posts will publish in ${monthName} (${season} in Australia).

== STEP 1: RESEARCH ==

Use web search to find genuine local detail. Search for:
1. "${suburbs[0]} ${city ?? ''}" — what is this suburb actually like? Key streets, landmarks, demographics, vibe.
2. "${category} ${season} Adelaide" or "${category} ${season} Australia" — real seasonal issues and tips for this trade.
3. "${suburbs[1]} ${city ?? ''}" — local context for the second suburb.

Use what you find to add specific local colour — not generic "residents of [suburb]" filler.

== STEP 2: WRITE 4 POSTS ==

Business: ${businessName}
Category (primary trade): ${category}
Location: ${city ?? ''}${state ? ', ' + state : ''}, Australia
Publish month: ${monthName} (${season})
Full services list (pick 2-3 per post from this): ${servicesSnippet}

POST ASSIGNMENTS:
${assignmentBlock}

DETAILED BRIEF PER POST:
${instructionBlock}

MANDATORY STRUCTURE — every post must follow this exactly:
1. Hook (1-2 sentences): Open with "${businessName} is a ${category} in [suburb]" OR "Looking for a ${category} in [suburb]? ${businessName} specialises in [service1], [service2], and [service3]." Do NOT start with a question that isn't followed immediately by the answer. Name 2-3 services from the list in this opening.
2. Body (2-3 sentences): Practical content (seasonal advice / local relevance / tip / job description depending on post type). Reference the suburb a second time naturally. Include a keyword phrase like "[service] in [suburb]" or "[suburb] [service]".
3. Why us (1 sentence): A quick differentiator — qualifications, years of experience, area coverage, or a specific capability.
4. Close (1 sentence): A natural ending that doesn't ask the reader to do anything.

MANDATORY RULES — all posts must pass every rule:
- 100-200 words MAX (not 300 — keep it tight)
- Suburb name appears 2-3 times naturally
- Names 2+ specific services from the list above (not generic "services" or "work")
- Contains ${category} keyword near the start
- References ${season} or ${monthName} genuinely
- City/state (${city ?? ''}, ${state ?? 'Australia'}) mentioned at least once
- No philosophical or narrative openings — NEVER start with:
  "There is a misconception...", "Here is something...", "It is amazing...",
  "One thing we hear...", "Something we see...", "A common thing..."
  (Transformation posts: "A customer came to us" is allowed ONLY for that type)
- No URLs, phone numbers, hashtags, emojis
- No em-dashes (—) or en-dashes (–) — use commas or periods
- No CTAs: "call us", "call now", "contact us", "get in touch", "reach out", "click here"

GOOD OPENING EXAMPLES (use these patterns):
"AYA Automotive is a mechanic in Unley specialising in used car servicing, brake repairs, and auto electrical work."
"Looking for a mechanic in Norwood? AYA Automotive offers log book servicing, suspension repairs, and roadworthy inspections across Norwood and inner Adelaide."
"Adelaide Car Detailing offers professional car detailing in Hyde Park including ceramic coating, paint correction, and full interior valets."

BAD OPENINGS (never use these):
"There is a misconception we hear fairly often..."
"Here is something we see all the time..."
"It is amazing what a proper [service] can do..."
"Here is a misconception we come across..."

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

  type PostResult = { text: string; violations: string[]; postServices: string[] };
  const results: PostResult[] = rawPosts.slice(0, 4).map((raw, i) => {
    const text = String(raw ?? '').trim();
    const { violations } = validatePost(text, suburbs[i], postServices[i], category);
    return { text, violations, postServices: postServices[i] };
  });

  // ── Phase 3: Retry failed posts (without web search) ──────────────────────

  for (let attempt = 0; attempt < 3; attempt++) {
    const failedIdxs = results
      .map((r, i) => (r.violations.length > 0 ? i : -1))
      .filter(i => i >= 0);
    if (!failedIdxs.length) break;

    const retryPrompt = `Rewrite the following Google Business Profile post(s) for ${businessName} (${category} in ${city ?? ''}, Australia). Fix every violation listed.

${failedIdxs
  .map(i => `--- POST ${i + 1} TO REWRITE ---
Type: ${postTypes[i].replace(/_/g, ' ')}
Suburb: ${suburbs[i]}
Services to name (use 2-3): ${postServices[i].join(', ')}
Publish: ${monthName} (${season} in Australia)
Violations to fix: ${results[i].violations.join(' | ')}

Brief: ${postTypeInstruction(postTypes[i], suburbs[i], postServices[i], businessName, category, city ?? '', state ?? '', season, monthName)}

Current text (fix this):
${results[i].text}`)
  .join('\n\n')}

RULES:
- 100-200 words
- Open with "${businessName} is a ${category} in [suburb]" or "Looking for a ${category} in [suburb]?" — NEVER a philosophical opener
- Name 2+ specific services from the services list in the post
- Mention the suburb 2+ times
- Reference ${season} or ${monthName}
- No URLs, phones, emojis, em/en-dashes, CTAs

Return ONLY a JSON object keyed by post number:
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
            const { violations } = validatePost(fixed, suburbs[idx], postServices[idx], category);
            results[idx] = { text: fixed, violations, postServices: postServices[idx] };
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
      target_service: postServices[i][0] ?? '',
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

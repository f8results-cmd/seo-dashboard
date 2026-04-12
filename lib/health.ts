import type { Client, Deliverable, GbpPost, StaffChecklistKey } from './types';

// All 26 standard staff checklist keys — used to compute delivery completion %
const STAFF_CHECKLIST_KEYS: StaffChecklistKey[] = [
  'gbp_primary_category', 'gbp_secondary_categories', 'gbp_description',
  'gbp_services', 'gbp_hours', 'gbp_logo', 'gbp_cover_photo', 'gbp_photos', 'gbp_ghl_connected',
  'website_reviewed', 'website_title_tags', 'website_mobile_check', 'website_sitemap', 'website_schema',
  'seo_services_approved', 'seo_category_pages', 'seo_internal_linking', 'seo_suburb_pages',
  'citations_leadsnap', 'citations_backlinks_reviewed', 'citations_top3_actioned', 'citations_nap_check',
  'client_welcome_email', 'client_gbp_guide', 'client_first_update', 'client_onboarding_call',
];

/**
 * Calculate health score (0–100) from client data.
 * Each criterion is worth 20 points:
 *   GBP connected         — ghl_location_id or gbp_url set
 *   52 posts scheduled    — gbp_posts count = 52
 *   Website live          — live_url set
 *   Citations submitted   — deliverable "Citations submitted" = complete
 *   Photos uploaded       — at least one photo in client.photos
 */
export function calcHealthScore(
  client: Client,
  deliverables: Deliverable[],
  gbpPostCount: number,
): number {
  let score = 0;

  if (client.ghl_location_id || client.gbp_url) score += 20;
  if (gbpPostCount >= 52) score += 20;
  if (client.live_url) score += 20;

  const citationDel = deliverables.find(d => d.label === 'Citations submitted');
  if (citationDel?.status === 'complete') score += 20;

  const photos = client.photos;
  if (photos && Object.values(photos).some(v => v !== null)) score += 20;

  return score;
}

export function healthColour(score: number): string {
  if (score >= 80) return '#22c55e';  // green
  if (score >= 40) return '#f97316';  // orange
  return '#ef4444';                    // red
}

export function healthLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 40) return 'Needs attention';
  return 'Critical';
}

/**
 * Calculate staff delivery checklist completion (0–26 tasks, returns pct/complete/total).
 */
export function calcStaffChecklistPct(client: Client): { pct: number; complete: number; total: number } {
  const checklist = client.onboarding_checklist?.checklist ?? {};
  const total = STAFF_CHECKLIST_KEYS.length;
  const complete = STAFF_CHECKLIST_KEYS.filter(k => !!checklist[k]).length;
  return { pct: Math.round((complete / total) * 100), complete, total };
}

/**
 * Calculate onboarding completion percentage from the 8-step checklist.
 */
export function calcOnboardingPct(
  client: Client,
  deliverables: Deliverable[],
  gbpPostCount: number,
): { pct: number; complete: number; total: number } {
  const checks: Partial<NonNullable<Client['onboarding_checklist']>> = client.onboarding_checklist ?? {};
  const citationDel = deliverables.find(d => d.label === 'Citations submitted');
  const hasJob = deliverables.some(d => d.status === 'complete');

  const steps = [
    !!checks.ghl_created,
    !!client.ghl_location_id,
    hasJob,
    !!checks.gbp_connected,
    gbpPostCount >= 52,
    !!checks.wp_activated,
    !!(client.photos && Object.values(client.photos).some(v => v !== null)),
    !!checks.first_update_sent,
  ];

  const complete = steps.filter(Boolean).length;
  return { pct: Math.round((complete / steps.length) * 100), complete, total: steps.length };
}

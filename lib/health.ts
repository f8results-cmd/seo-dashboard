import type { Client, Deliverable, GbpPost } from './types';

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
 * Calculate onboarding completion percentage from the 8-step checklist.
 */
export function calcOnboardingPct(
  client: Client,
  deliverables: Deliverable[],
  gbpPostCount: number,
): { pct: number; complete: number; total: number } {
  const checks = client.onboarding_checklist ?? {};
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

import type { Client } from './types';

export type SetupStatusResult =
  | { status: 'complete';       label: 'Setup Complete';        color: 'green' }
  | { status: 'review_needed';  label: 'Manual review needed';  color: 'amber' }
  | { status: 'incomplete';     label: 'Setup incomplete';      color: 'red'   };

export interface SetupValidation {
  hasPrimary: boolean;
  hasSecondary: boolean;
  hasServices: boolean;
  hasNotes: boolean;
  hasSuburbs: boolean;
  allValid: boolean;
  missing: string[];
}

export function getSetupValidation(client: Client): SetupValidation {
  const hasPrimary  = !!client.gbp_primary_category?.trim();
  const hasSecondary = (client.gbp_secondary_categories?.filter(Boolean).length ?? 0) > 0;
  const hasServices  = (client.manual_services?.trim().length ?? 0) > 50;
  const hasNotes     = (client.agency_notes?.trim().length ?? 0) > 100;
  const hasSuburbs   = (client.target_suburbs?.filter(Boolean).length ?? 0) > 0;

  const missing: string[] = [];
  if (!hasPrimary)  missing.push('primary GBP category');
  if (!hasSecondary) missing.push('at least one secondary category');
  if (!hasServices)  missing.push('services (50+ chars)');
  if (!hasNotes)     missing.push('agency notes (100+ chars)');
  if (!hasSuburbs)   missing.push('target suburbs');

  return { hasPrimary, hasSecondary, hasServices, hasNotes, hasSuburbs, allValid: missing.length === 0, missing };
}

export function getSetupStatus(client: Client): SetupStatusResult {
  const { allValid } = getSetupValidation(client);
  if (allValid) return { status: 'complete', label: 'Setup Complete', color: 'green' };

  const wd = client.website_data as Record<string, unknown> | null;
  const pipelineRan = !!(wd?.gbp_guide);
  const manualOverride = wd?.gbp_manual_override === true;
  if (pipelineRan && !manualOverride) {
    return { status: 'review_needed', label: 'Manual review needed', color: 'amber' };
  }

  return { status: 'incomplete', label: 'Setup incomplete', color: 'red' };
}

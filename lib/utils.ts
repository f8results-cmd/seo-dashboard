const NICHE_LABELS: Record<string, string> = {
  car_detailing:   'Car Detailing',
  ndis_provider:   'NDIS Provider',
  used_car_dealer: 'Used Car Dealer',
  window_cleaning: 'Window Cleaning',
  lawn_and_garden: 'Lawn & Garden',
  mortgage_broker: 'Mortgage Broker',
  real_estate:     'Real Estate',
  plumber:         'Plumber',
  electrician:     'Electrician',
  cleaning:        'Cleaning',
  accountant:      'Accountant',
};

/**
 * Converts a niche key (e.g. "car_detailing") to a readable label (e.g. "Car Detailing").
 * Falls back to title-casing the key with underscores replaced by spaces for unknown niches.
 */
export function formatNiche(niche: string): string {
  if (!niche) return '';
  return NICHE_LABELS[niche] ?? niche.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

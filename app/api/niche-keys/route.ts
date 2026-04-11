import { NextResponse } from 'next/server';

// Cache niche keys for 1 hour — they change only on deploys
export const revalidate = 3600;

interface NicheExtendedConfig {
  label: string;
  gbp_primary: string;
  gbp_secondary: string[];
  design_personality: string;
  hero_cta: string;
  content_opener: string;
  local_hook: string;
  keywords_template: string[];
}

// Mirror of seo-platform/niche_config.py — keep in sync on deploy
const NICHE_EXTENDED_CONFIG: Record<string, NicheExtendedConfig> = {
  ndis_provider: {
    label: 'NDIS / Disability Support Provider',
    gbp_primary: 'Disability services & support organisation',
    gbp_secondary: [
      'Social services organisation',
      'Home health care service',
      'Community health centre',
      'Disability equipment supplier',
      'Non-profit organisation',
      'Youth social services organisation',
      'Medical clinic',
    ],
    design_personality: 'warm, human, accessible, calming',
    hero_cta: 'Talk to Our Team',
    content_opener: 'Living with disability in [city] means navigating a system that isn\'t always easy.',
    local_hook: 'Our participants across [suburbs] prefer support that comes to them.',
    keywords_template: ['NDIS provider [city]', 'disability support [city]', 'NDIS support worker [city]'],
  },
  plumber: {
    label: 'Plumber / Gas Fitter',
    gbp_primary: 'Plumber',
    gbp_secondary: [
      'Gas installation service',
      'Drainage service',
      'Hot water system supplier',
      'Blocked drain service',
      'Emergency plumber',
      'Bathroom renovation contractor',
      'Heating contractor',
    ],
    design_personality: 'bold, trustworthy, high contrast, emergency-ready',
    hero_cta: 'Call Now — Available 24/7',
    content_opener: '[City]\'s older homes weren\'t built for modern plumbing demands.',
    local_hook: 'We work across [suburbs] and know the pipe problems that come with [city] housing stock.',
    keywords_template: ['plumber [city]', 'emergency plumber [city]', 'blocked drain [city]'],
  },
  electrician: {
    label: 'Electrician',
    gbp_primary: 'Electrician',
    gbp_secondary: [
      'Electrical installation service',
      'Solar energy contractor',
      'Security system installer',
      'Lighting contractor',
      'Emergency electrician',
      'Smart home installer',
      'Data cabling contractor',
    ],
    design_personality: 'professional, safety-first, clean and sharp',
    hero_cta: 'Get a Free Quote',
    content_opener: 'Electrical problems in [city] homes can\'t wait.',
    local_hook: 'From new builds in [suburbs] to heritage homes in the inner suburbs, we handle it all.',
    keywords_template: ['electrician [city]', 'emergency electrician [city]', 'solar electrician [city]'],
  },
  window_cleaning: {
    label: 'Window Cleaning',
    gbp_primary: 'Window cleaning service',
    gbp_secondary: [
      'Commercial cleaning service',
      'Building cleaning service',
      'Gutter cleaning service',
      'Pressure washing service',
      'Solar panel cleaning service',
      'Exterior cleaning service',
    ],
    design_personality: 'clean, bright, satisfying, streak-free aesthetic',
    hero_cta: 'Get a Free Quote',
    content_opener: '[City]\'s conditions leave windows covered in dust, salt, and streaks.',
    local_hook: 'We clean homes and businesses across [suburbs] every week.',
    keywords_template: ['window cleaning [city]', 'commercial window cleaning [city]', 'window cleaner [city]'],
  },
  used_car_dealer: {
    label: 'Used Car Dealer',
    gbp_primary: 'Used car dealer',
    gbp_secondary: [
      'Car dealer',
      'Car finance and loan company',
      'Auto broker',
      'Car inspection station',
      'Motor vehicle dealer',
    ],
    design_personality: 'trust-forward, search-driven, finance-prominent, review-heavy',
    hero_cta: 'Browse Our Stock',
    content_opener: 'Finding a reliable used car in [city] shouldn\'t feel like a gamble.',
    local_hook: 'We\'re based in [suburb] and serve buyers across [suburbs].',
    keywords_template: ['used cars [city]', 'second hand cars [city]', 'buy used car [city]'],
  },
  lawn_and_garden: {
    label: 'Lawn & Garden / Landscaping',
    gbp_primary: 'Landscaper',
    gbp_secondary: [
      'Lawn care service',
      'Garden maintenance service',
      'Tree service',
      'Irrigation system contractor',
      'Retaining wall contractor',
      'Artificial grass installer',
    ],
    design_personality: 'fresh, outdoor, green, seasonal',
    hero_cta: 'Get a Free Quote',
    content_opener: '[City] summers are tough on lawns.',
    local_hook: 'We maintain gardens across [suburbs] year-round.',
    keywords_template: ['landscaper [city]', 'lawn mowing [city]', 'garden maintenance [city]'],
  },
  cleaning: {
    label: 'Cleaning Service',
    gbp_primary: 'House cleaning service',
    gbp_secondary: [
      'Commercial cleaning service',
      'Carpet cleaning service',
      'End of lease cleaning service',
      'Window cleaning service',
      'Pressure washing service',
      'Office cleaning service',
    ],
    design_personality: 'clean, bright, trustworthy, domestic feel',
    hero_cta: 'Book a Clean',
    content_opener: 'A clean home in [city] starts with a team you can trust.',
    local_hook: 'We clean homes across [suburbs] weekly, fortnightly, and on demand.',
    keywords_template: ['house cleaning [city]', 'end of lease cleaning [city]', 'commercial cleaning [city]'],
  },
  accountant: {
    label: 'Accountant / Bookkeeper',
    gbp_primary: 'Accountant',
    gbp_secondary: [
      'Tax preparation service',
      'Bookkeeping service',
      'Financial planner',
      'Business management consultant',
      'Payroll service',
    ],
    design_personality: 'conservative, credibility-first, muted palette, credentials prominent',
    hero_cta: 'Book a Consultation',
    content_opener: 'Tax time in [city] doesn\'t have to be stressful.',
    local_hook: 'We work with small businesses and sole traders across [suburbs].',
    keywords_template: ['accountant [city]', 'tax agent [city]', 'bookkeeper [city]'],
  },
  real_estate: {
    label: 'Real Estate Agent',
    gbp_primary: 'Real estate agency',
    gbp_secondary: [
      'Real estate agent',
      'Property management company',
      'Commercial real estate agency',
      'Real estate rental agency',
    ],
    design_personality: 'premium, area-expert, photography-forward, suburb-specific',
    hero_cta: 'Get a Free Appraisal',
    content_opener: 'The [city] property market moves fast.',
    local_hook: 'We specialise in [suburbs] and know every street.',
    keywords_template: ['real estate agent [city]', 'property management [city]', 'houses for sale [city]'],
  },
  mortgage_broker: {
    label: 'Mortgage Broker',
    gbp_primary: 'Mortgage broker',
    gbp_secondary: [
      'Financial planner',
      'Loan agency',
      'Insurance agency',
      'Financial institution',
    ],
    design_personality: 'trustworthy, numbers-forward, calm and professional',
    hero_cta: 'Get a Free Assessment',
    content_opener: 'Getting the right home loan in [city] can save you thousands.',
    local_hook: 'We help buyers across [suburbs] find the right finance.',
    keywords_template: ['mortgage broker [city]', 'home loan [city]', 'refinance [city]'],
  },
  car_detailing: {
    label: 'Car / Vehicle Detailing',
    gbp_primary: 'Car detailing service',
    gbp_secondary: [
      'Car wash',
      'Auto detailing service',
      'Truck accessories store',
      'Boat accessories supplier',
      'Mobile car wash service',
      'Cleaning service',
    ],
    design_personality: 'clean, shiny, premium finish, before/after focused',
    hero_cta: 'Book a Detail',
    content_opener: 'Heat and dust are brutal on your car\'s paint.',
    local_hook: 'We come to you across [suburbs] — no need to drop your car anywhere.',
    keywords_template: ['mobile car detailing [city]', 'car detailer [city]', 'boat detailing [city]'],
  },
};

const FALLBACK_NICHES = Object.entries(NICHE_EXTENDED_CONFIG).map(([key, v]) => ({
  key,
  label: v.label,
}));

export async function GET() {
  const railwayUrl = process.env.RAILWAY_URL ?? process.env.NEXT_PUBLIC_RAILWAY_URL;

  if (!railwayUrl) {
    return NextResponse.json({ niches: FALLBACK_NICHES, config: NICHE_EXTENDED_CONFIG });
  }

  try {
    const res = await fetch(`${railwayUrl}/niche-keys`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Railway responded ${res.status}`);
    const data = await res.json();
    // Railway only returns key+label pairs; config always comes from the embedded constant
    return NextResponse.json({ niches: data.niches ?? FALLBACK_NICHES, config: NICHE_EXTENDED_CONFIG });
  } catch {
    return NextResponse.json({ niches: FALLBACK_NICHES, config: NICHE_EXTENDED_CONFIG });
  }
}

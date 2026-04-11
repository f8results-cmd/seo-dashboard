import { NextResponse } from 'next/server';

// Cache niche keys for 1 hour — they change only on deploys
export const revalidate = 3600;

const FALLBACK_NICHES = [
  { key: 'ndis_provider', label: 'NDIS / Disability Support Provider' },
  { key: 'plumber', label: 'Plumber / Gas Fitter' },
  { key: 'electrician', label: 'Electrician' },
  { key: 'window_cleaning', label: 'Window Cleaning' },
  { key: 'used_car_dealer', label: 'Used Car Dealer' },
  { key: 'lawn_and_garden', label: 'Lawn & Garden / Landscaping' },
  { key: 'cleaning', label: 'Cleaning Service' },
  { key: 'accountant', label: 'Accountant / Bookkeeper' },
  { key: 'real_estate', label: 'Real Estate Agent' },
  { key: 'mortgage_broker', label: 'Mortgage Broker' },
];

export async function GET() {
  const railwayUrl = process.env.RAILWAY_URL ?? process.env.NEXT_PUBLIC_RAILWAY_URL;

  if (!railwayUrl) {
    return NextResponse.json({ niches: FALLBACK_NICHES });
  }

  try {
    const res = await fetch(`${railwayUrl}/niche-keys`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Railway responded ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // Railway unreachable — serve fallback so the form still works
    return NextResponse.json({ niches: FALLBACK_NICHES });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    business_name, owner_name, email, phone,
    address, city, state, postcode,
    niche, tagline, years_in_business,
    website_url, gbp_url,
    service_areas, notes,
  } = body;

  if (!business_name?.trim() || !email?.trim() || !city?.trim()) {
    return NextResponse.json(
      { error: 'business_name, email, and city are required.' },
      { status: 422 }
    );
  }

  const supabase = createClient();

  // Build agency_notes from service areas + client notes
  const noteParts: string[] = [];
  if (service_areas?.trim()) noteParts.push(`Service areas: ${service_areas.trim()}`);
  if (notes?.trim()) noteParts.push(notes.trim());

  const { data, error } = await supabase.from('clients').insert({
    business_name:    business_name.trim(),
    owner_name:       owner_name?.trim() || null,
    email:            email.trim(),
    phone:            phone?.trim() || null,
    address:          address?.trim() || null,
    city:             city.trim(),
    state:            state?.trim() || null,
    postcode:         postcode?.trim() || null,
    niche:            niche?.trim() || null,
    tagline:          tagline?.trim() || null,
    years_in_business: years_in_business ? parseInt(years_in_business) : null,
    website_url:      website_url?.trim() || null,
    gbp_url:          gbp_url?.trim() || null,
    agency_notes:     noteParts.join('\n\n') || null,
    status:           'pending',
  }).select('id').single();

  if (error || !data) {
    console.error('Public onboard error:', error);
    return NextResponse.json(
      { error: 'Failed to create client record.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, client_id: data.id }, { status: 201 });
}

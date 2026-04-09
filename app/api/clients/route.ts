import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      business_name,
      owner_name,
      email,
      phone,
      address,
      city,
      state,
      niche,
      website_url,
      gbp_url,
      tagline,
      years_in_business,
      brand_primary_color,
      brand_accent_color,
      ghl_location_id,
      ghl_api_key,
      notes,
    } = body;

    if (!business_name || !email) {
      return NextResponse.json({ error: 'business_name and email are required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('clients')
      .insert({
        business_name: business_name.trim(),
        owner_name: owner_name?.trim() || null,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        niche: niche?.trim() || null,
        website_url: website_url?.trim() || null,
        gbp_url: gbp_url?.trim() || null,
        tagline: tagline?.trim() || null,
        years_in_business: years_in_business ? parseInt(String(years_in_business)) : null,
        brand_primary_color: brand_primary_color || '#1B2B6B',
        brand_accent_color: brand_accent_color || '#E8622A',
        ghl_location_id: ghl_location_id?.trim() || null,
        ghl_api_key: ghl_api_key?.trim() || null,
        notes: notes?.trim() || null,
        status: 'pending',
      })
      .select('id, business_name')
      .single();

    if (error) {
      console.error('[API /clients] Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, client: data }, { status: 201 });
  } catch (err) {
    console.error('[API /clients] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

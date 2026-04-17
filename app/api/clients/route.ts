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
      postcode,
      niche,
      website_url,
      gbp_url,
      gbp_location_name,
      google_place_id,
      tagline,
      years_in_business,
      review_count,
      review_rating,
      brand_primary_color,
      brand_accent_color,
      ghl_location_id,
      ghl_api_key,
      ghl_webhook_url,
      google_maps_embed_url,
      google_tag_id,
      logo_url,
      skip_website,
      auto_respond_reviews,
      blog_delivery,
      agency_notes,
      manages_website,
      website_hosting,
      domain_registrar,
      domain_owner,
      webmaster_contact,
      can_make_changes,
      access_notes,
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
        postcode: postcode?.trim() || null,
        niche: niche?.trim() || null,
        website_url: website_url?.trim() || null,
        gbp_url: gbp_url?.trim() || null,
        gbp_location_name: gbp_location_name?.trim() || null,
        google_place_id: google_place_id?.trim() || null,
        tagline: tagline?.trim() || null,
        years_in_business: years_in_business ? parseInt(String(years_in_business)) : null,
        review_count: review_count ? parseInt(String(review_count)) : null,
        review_rating: review_rating ? parseFloat(String(review_rating)) : null,
        brand_primary_color: brand_primary_color || '#1B2B6B',
        brand_accent_color: brand_accent_color || '#E8622A',
        ghl_location_id: ghl_location_id?.trim() || null,
        ghl_api_key: ghl_api_key?.trim() || null,
        ghl_webhook_url: ghl_webhook_url?.trim() || null,
        google_maps_embed_url: google_maps_embed_url?.trim() || null,
        google_tag_id: google_tag_id?.trim() || null,
        skip_website: Boolean(skip_website),
        auto_respond_reviews: Boolean(auto_respond_reviews),
        blog_delivery: blog_delivery?.trim() || null,
        agency_notes: agency_notes?.trim() || null,
        logo_url: logo_url?.trim() || null,
        manages_website: manages_website !== undefined ? Boolean(manages_website) : true,
        website_hosting: website_hosting?.trim() || null,
        domain_registrar: domain_registrar?.trim() || null,
        domain_owner: domain_owner?.trim() || null,
        webmaster_contact: webmaster_contact?.trim() || null,
        can_make_changes: Boolean(can_make_changes),
        access_notes: access_notes?.trim() || null,
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

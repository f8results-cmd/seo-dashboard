import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_CLIENT_FIELDS = new Set([
  'business_name', 'owner_name', 'status', 'health_score', 'niche', 'city', 'state',
  'live_url', 'phone', 'email', 'ghl_location_id', 'ghl_webhook_url', 'ghl_social_planner_url',
  'logo_url', 'photo_drive_url', 'inspiration_url', 'onboarding_date', 'onboarding_checklist',
  'staff_checklist', 'website_data', 'photos', 'manages_website', 'can_make_changes',
  'last_friday_update', 'gbp_post_count', 'gbp_primary_category', 'gbp_secondary_categories',
  'primary_keywords', 'suburb_pages', 'has_ghl', 'rollout_is_auto',
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const raw = await request.json();
    const body = Object.fromEntries(
      Object.entries(raw).filter(([k]) => ALLOWED_CLIENT_FIELDS.has(k))
    );
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('clients')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[API /clients/[id]] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, client: data });
  } catch (err) {
    console.error('[API /clients/[id]] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

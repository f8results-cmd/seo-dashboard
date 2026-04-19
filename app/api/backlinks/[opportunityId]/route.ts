import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

// PATCH /api/backlinks/[opportunityId]
// Update status, notes, outreach_sent_at, last_contact_date on an opportunity.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    // Whitelist updatable fields — no client_id, type, url overrides from UI
    const allowed: Record<string, unknown> = {};
    const UPDATABLE = [
      'status', 'notes', 'outreach_sent_at', 'last_contact_date',
    ] as const;
    for (const key of UPDATABLE) {
      if (key in body) allowed[key] = body[key] ?? null;
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('backlink_opportunities')
      .update(allowed)
      .eq('id', params.opportunityId)
      .select()
      .single();

    if (error) {
      console.error('[API backlinks PATCH]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, opportunity: data });
  } catch (err) {
    console.error('[API backlinks PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/backlinks/[opportunityId]
// Remove an opportunity row.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  try {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('backlink_opportunities')
      .delete()
      .eq('id', params.opportunityId);

    if (error) {
      console.error('[API backlinks DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API backlinks DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

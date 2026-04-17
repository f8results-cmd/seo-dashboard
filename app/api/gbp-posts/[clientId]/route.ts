import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

type Params = { params: { clientId: string } };

// GET /api/gbp-posts/[clientId] — list all posts for client (service client, bypasses RLS)
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('gbp_posts')
    .select('*')
    .eq('client_id', params.clientId)
    .order('scheduled_date', { ascending: true });

  if (error) {
    console.error('[API /gbp-posts] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

// PATCH /api/gbp-posts/[clientId] — update one post
// body: { id: string, ...fields }
export async function PATCH(req: NextRequest, { params: _p }: Params) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('gbp_posts')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[API /gbp-posts] PATCH error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, post: data });
  } catch (err) {
    console.error('[API /gbp-posts] PATCH unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/gbp-posts/[clientId] — delete one or many posts
// body: { id: string } or { ids: string[] }
export async function DELETE(req: NextRequest, { params: _p }: Params) {
  try {
    const body = await req.json();
    const supabase = createServiceClient();

    if (body.ids && Array.isArray(body.ids)) {
      const { error } = await supabase
        .from('gbp_posts')
        .delete()
        .in('id', body.ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, deleted: body.ids.length });
    }

    if (body.id) {
      const { error } = await supabase
        .from('gbp_posts')
        .delete()
        .eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, deleted: 1 });
    }

    return NextResponse.json({ error: 'id or ids required' }, { status: 400 });
  } catch (err) {
    console.error('[API /gbp-posts] DELETE unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

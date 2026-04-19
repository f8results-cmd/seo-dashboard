import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

// GET /api/clients/[id]/backlinks
// Returns all backlink opportunities for a client, ordered by priority then created_at.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('backlink_opportunities')
      .select('*')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API backlinks GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort client-side: high → medium → low, then by created_at desc
    const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = (data ?? []).sort((a, b) => {
      const pd = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
      if (pd !== 0) return pd;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({ opportunities: sorted });
  } catch (err) {
    console.error('[API backlinks GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

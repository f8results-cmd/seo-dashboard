import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function supabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// ── PATCH /api/clients/[id]/rollout/items/[itemId] ────────────────────────────
// Toggle item completed, optionally update notes.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const sb = supabase();
  const { itemId } = params;
  const body = await req.json() as { completed?: boolean; notes?: string };

  const updates: Record<string, unknown> = {};
  if (body.completed !== undefined) {
    updates.completed    = body.completed;
    updates.completed_at = body.completed ? new Date().toISOString() : null;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes;
  }

  const { data, error } = await sb
    .from('client_rollout_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

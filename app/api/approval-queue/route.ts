/**
 * POST /api/approval-queue
 *
 * Server-side insert into approval_queue using the service role key (bypasses RLS).
 * Client components must call this endpoint instead of writing to Supabase directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.client_id || !body.action_type) {
    return NextResponse.json({ error: 'client_id and action_type are required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('approval_queue')
    .insert({
      client_id:    body.client_id,
      action_type:  body.action_type,
      content_data: body.content_data ?? {},
      status:       body.status ?? 'pending',
      scheduled_for: body.scheduled_for ?? null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

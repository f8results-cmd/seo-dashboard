/**
 * Proxy approval queue actions to the Railway backend.
 * POST /api/approval-queue/{id}?action=approve|reject|edit|publish|approve-and-publish
 * PATCH /api/approval-queue/{id} — update content_data fields (e.g. photo_url) directly in Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const RAILWAY_URL = process.env.RAILWAY_URL ?? process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!RAILWAY_URL) {
    return NextResponse.json({ error: 'RAILWAY_URL not configured' }, { status: 503 });
  }

  const { id } = params;
  const action = req.nextUrl.searchParams.get('action') ?? 'approve';

  const validActions = ['approve', 'reject', 'edit', 'publish', 'approve-and-publish'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  }

  let body: string | undefined;
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    body = await req.text();
  }

  const upstream = `${RAILWAY_URL.replace(/\/$/, '')}/approval-queue/${id}/${action}`;
  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body || undefined,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json().catch(() => ({}));

  const supabase = createServiceClient();

  const { data: item, error: fetchErr } = await supabase
    .from('approval_queue')
    .select('content_data')
    .eq('id', id)
    .single();

  if (fetchErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const newContentData = { ...(item.content_data as Record<string, unknown>), ...body };

  const { error: updateErr } = await supabase
    .from('approval_queue')
    .update({ content_data: newContentData })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, content_data: newContentData });
}

/**
 * Proxy approval queue actions to the Railway backend.
 * POST /api/approval-queue/{id}?action=approve|reject|edit|publish|approve-and-publish
 */

import { NextRequest, NextResponse } from 'next/server';

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

import { NextResponse, type NextRequest } from 'next/server';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

// GET /api/clients/[id]/ai-edit  →  conversation history
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(`${RAILWAY_URL}/ai-edit/${params.id}/history`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error('[API ai-edit GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/clients/[id]/ai-edit  →  send message, get reply + diff
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const res = await fetch(`${RAILWAY_URL}/ai-edit/${params.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body.message }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error('[API ai-edit POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from 'next/server';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

// POST /api/clients/[id]/ai-edit/confirm/[turnId]
// Applies a previously proposed diff and pushes to GitHub.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; turnId: string } }
) {
  try {
    const res = await fetch(
      `${RAILWAY_URL}/ai-edit/${params.id}/confirm/${params.turnId}`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error('[API ai-edit confirm]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

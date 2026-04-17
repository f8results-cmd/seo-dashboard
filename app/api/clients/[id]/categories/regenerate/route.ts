import { NextResponse, type NextRequest } from 'next/server';

type Params = { params: { id: string } };

// POST /api/clients/[id]/categories/regenerate
// Calls Railway to ask Claude for fresh category suggestions.
// Returns suggestions only — does NOT save to the database.
export async function POST(_req: NextRequest, { params }: Params) {
  const railwayUrl = process.env.RAILWAY_URL ?? process.env.NEXT_PUBLIC_RAILWAY_URL;
  if (!railwayUrl) {
    return NextResponse.json({ error: 'RAILWAY_URL not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${railwayUrl}/categories/${params.id}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body?.detail ?? `Railway returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

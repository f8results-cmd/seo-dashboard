import { NextResponse, type NextRequest } from 'next/server';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

// POST /api/clients/[id]/photos/analyze
// Proxies to the Railway platform POST /photos/analyze endpoint.
// Body: { photos: [{ url: string; index: number }] }
// Response: { results: [{ index, url, suggested_label, is_hero_candidate, quality_score, description }] }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const photos = body.photos;

    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: 'photos array required' }, { status: 400 });
    }

    if (!RAILWAY_URL) {
      return NextResponse.json({ error: 'RAILWAY_URL not configured' }, { status: 500 });
    }

    const upstream = await fetch(`${RAILWAY_URL}/photos/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos }),
      // Analysis can take a few seconds per photo; allow up to 90s for 20 photos
      signal: AbortSignal.timeout(90_000),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[API photos/analyze] Upstream error:', upstream.status, text);
      return NextResponse.json(
        { error: `Analysis failed: ${upstream.status}` },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[API photos/analyze] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

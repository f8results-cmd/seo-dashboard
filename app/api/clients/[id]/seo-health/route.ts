import { NextResponse, type NextRequest } from 'next/server';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

// GET /api/clients/[id]/seo-health  →  latest score + 12-week history
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [latestRes, historyRes] = await Promise.all([
      fetch(`${RAILWAY_URL}/seo-health/${params.id}/latest`, {
        signal: AbortSignal.timeout(15_000),
      }),
      fetch(`${RAILWAY_URL}/seo-health/${params.id}/history`, {
        signal: AbortSignal.timeout(15_000),
      }),
    ]);

    const latest = latestRes.ok ? await latestRes.json() : { score: null };
    const history = historyRes.ok ? await historyRes.json() : { history: [] };

    return NextResponse.json({ latest, history: history.history ?? [] });
  } catch (err) {
    console.error('[API seo-health GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/clients/[id]/seo-health  →  trigger rescore (background task)
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(`${RAILWAY_URL}/seo-health/${params.id}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error('[API seo-health POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

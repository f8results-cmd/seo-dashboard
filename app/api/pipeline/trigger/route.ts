import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  // Verify agency auth
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (authError || user?.email !== 'sebastian@figure8results.com') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { client_id } = body;

  if (!client_id) {
    return NextResponse.json({ error: 'client_id required' }, { status: 400 });
  }

  const railwayUrl = process.env.NEXT_PUBLIC_RAILWAY_URL;
  if (!railwayUrl) {
    return NextResponse.json({ error: 'Railway URL not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${railwayUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ success: res.ok, data }, { status: res.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to reach Railway' }, { status: 502 });
  }
}

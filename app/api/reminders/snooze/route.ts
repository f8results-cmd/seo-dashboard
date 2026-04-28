import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { client_id } = await req.json();
  if (!client_id) {
    return NextResponse.json({ error: 'Missing client_id' }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('clients')
    .update({ last_friday_update: new Date().toISOString() })
    .eq('id', client_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

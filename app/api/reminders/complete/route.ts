import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { id, type, client_id } = await req.json();
  if (!type || !client_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createClient();

  if (type === 'friday_update') {
    const { error } = await supabase
      .from('clients')
      .update({ last_friday_update: new Date().toISOString() })
      .eq('id', client_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else if (type === 'task') {
    // id format: "task-{uuid}"
    const taskId = (id as string).replace(/^task-/, '');
    const { error } = await supabase
      .from('client_tasks')
      .update({ completed: true })
      .eq('id', taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  }
  // onboarding type: no persistent dismiss field — just removed from UI optimistically

  return NextResponse.json({ ok: true });
}

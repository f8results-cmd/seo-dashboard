import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('clients')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[API /clients/[id]] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, client: data });
  } catch (err) {
    console.error('[API /clients/[id]] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

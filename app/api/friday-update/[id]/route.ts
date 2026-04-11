import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const RAILWAY_URL = process.env.RAILWAY_URL ?? '';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const clientId = params.id;

  if (!clientId) {
    return NextResponse.json({ error: 'Missing client ID' }, { status: 400 });
  }

  // Fetch client data for context
  const supabase = createClient();
  const { data: client, error } = await supabase
    .from('clients')
    .select('business_name, niche, city, state, last_friday_update')
    .eq('id', clientId)
    .single();

  if (error || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Proxy to Railway backend if URL is set
  if (RAILWAY_URL) {
    try {
      const res = await fetch(`${RAILWAY_URL}/friday-update/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      return NextResponse.json(json, { status: res.status });
    } catch {
      return NextResponse.json({ error: 'Railway backend unreachable' }, { status: 502 });
    }
  }

  // Fallback: generate a simple draft using Anthropic API directly
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'No Railway URL or Anthropic API key configured' }, { status: 500 });
  }

  // Fetch recent jobs for context
  const { data: jobs } = await supabase
    .from('jobs')
    .select('agent_name, status, started_at')
    .eq('client_id', clientId)
    .order('started_at', { ascending: false })
    .limit(10);

  const recentActivity = (jobs ?? [])
    .map(j => `- ${j.agent_name} (${j.status})`)
    .join('\n') || 'No recent pipeline activity.';

  const prompt = `Write a friendly, professional Friday SEO update email for a client.

Business: ${client.business_name}
Trade: ${client.niche ?? 'Unknown'}
Location: ${client.city ?? ''}${client.state ? ', ' + client.state : ''}

Recent work completed:
${recentActivity}

Write a concise update (150–250 words) covering:
1. What was done this week
2. What we're working on next
3. A quick win or positive stat if relevant

Tone: professional, friendly, confident. Start with "Hi [First Name]," and end with a signature.`;

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }

  const ai = await anthropicRes.json();
  const draft = ai.content?.[0]?.text ?? '';

  return NextResponse.json({ draft });
}

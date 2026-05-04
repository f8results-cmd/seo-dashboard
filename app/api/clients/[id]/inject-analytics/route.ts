import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? '';
const GITHUB_API = 'https://api.github.com';

async function githubGet(repo: string, path: string): Promise<{ ok: boolean; content?: string; sha?: string; error?: string }> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false, error: `GitHub GET ${res.status}: ${await res.text().catch(() => '')}` };
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { ok: true, content, sha: data.sha };
}

async function githubPut(repo: string, path: string, content: string, sha: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
    }),
  });
  if (!res.ok) return { ok: false, error: `GitHub PUT ${res.status}: ${await res.text().catch(() => '')}` };
  return { ok: true };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_TOKEN not configured on server' }, { status: 500 });
  }

  const supabase = createServiceClient();
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('business_name, github_repo, google_tag_id')
    .eq('id', params.id)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const { github_repo: repo, google_tag_id: tagId } = client;

  if (!repo) {
    return NextResponse.json({ error: 'No GitHub repo configured for this client' }, { status: 400 });
  }

  // Read current client-data.json — preserves all manual edits
  const getResult = await githubGet(repo, 'client-data.json');
  if (!getResult.ok || !getResult.content || !getResult.sha) {
    return NextResponse.json({ error: `Could not read client-data.json: ${getResult.error}` }, { status: 502 });
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(getResult.content);
  } catch {
    return NextResponse.json({ error: 'Could not parse client-data.json' }, { status: 502 });
  }

  // Patch only analytics.google_tag_id — everything else is untouched
  if (!data.analytics || typeof data.analytics !== 'object') {
    data.analytics = {};
  }
  (data.analytics as Record<string, unknown>).google_tag_id = tagId ?? null;

  const putResult = await githubPut(
    repo,
    'client-data.json',
    JSON.stringify(data, null, 2),
    getResult.sha,
    `feat: inject GA4 tag ${tagId ?? '(cleared)'}`,
  );

  if (!putResult.ok) {
    return NextResponse.json({ error: `GitHub push failed: ${putResult.error}` }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    google_tag_id: tagId,
    message: `GA4 tag ${tagId ?? '(cleared)'} injected. Vercel will rebuild in ~2 minutes.`,
  });
}

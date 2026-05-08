/**
 * GET /api/reminders/friday-update?secret=CRON_SECRET
 *
 * Sends a single digest reminder email to the operator listing every active
 * client who needs a Friday update. Hit this endpoint from a Railway cron job
 * (or any external cron service) every Friday morning.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const OPERATOR_EMAIL = 'sebastian.willis-hell@outlook.com';
const FROM_EMAIL     = process.env.SENDGRID_FROM_EMAIL ?? 'sebastian@figure8results.com';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch all active clients that have a name set
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, business_name, owner_name, email, last_friday_update')
    .not('status', 'eq', 'inactive')
    .not('status', 'eq', 'complete')
    .order('business_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, message: 'No active clients — no reminder sent.' });
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  const clientLines = clients.map(c => {
    const lastSent = c.last_friday_update
      ? new Date(c.last_friday_update).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
      : 'never';
    return `  • ${c.business_name}${c.owner_name ? ` (${c.owner_name})` : ''} — last sent: ${lastSent}`;
  }).join('\n');

  const body = `Hey Seb,

It's Friday — time to send weekly SEO updates to your clients.

${dateStr}

CLIENTS TO UPDATE (${clients.length}):
${clientLines}

Cheers,
Figure 8 Results (automated reminder)`;

  const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: OPERATOR_EMAIL }] }],
      from: { email: FROM_EMAIL },
      subject: `Friday SEO Update Reminder — ${clients.length} clients`,
      content: [{ type: 'text/plain', value: body }],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!sgRes.ok) {
    const errText = await sgRes.text().catch(() => '');
    return NextResponse.json({ error: `SendGrid ${sgRes.status}: ${errText.slice(0, 200)}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, clients_reminded: clients.length });
}

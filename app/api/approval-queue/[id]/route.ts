/**
 * /api/approval-queue/[id]
 *
 * Railway-independent approval queue actions — all operations hit Supabase
 * and the GHL API directly. Railway is no longer required for any of these.
 *
 * POST ?action=approve|reject|edit|publish|approve-and-publish
 * PATCH — merge fields into content_data (e.g. photo_url)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const maxDuration = 30;

// ── GHL GBP post publishing ───────────────────────────────────────────────────

async function publishViaGhl(
  locationId: string,
  apiKey: string,
  postText: string,
  phone: string,
): Promise<{ success: boolean; postId: string; error: string }> {
  const payload: Record<string, unknown> = {
    type: 'google',
    summary: postText,
  };
  // Phone CTA only if phone is present (no website URLs — operator request)
  if (phone) {
    payload.callToAction = {
      actionType: 'CALL',
      url: `tel:${phone.replace(/\s/g, '')}`,
    };
  }

  const res = await fetch(
    'https://services.leadconnectorhq.com/social-media-posting/oauth/google/posts',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    },
  );

  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    const postId =
      (data as Record<string, unknown>).id ??
      (data as Record<string, unknown>).postId ??
      '';
    return { success: true, postId: String(postId), error: '' };
  }

  const text = await res.text().catch(() => '');
  return { success: false, postId: '', error: `GHL ${res.status}: ${text.slice(0, 200)}` };
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const action = req.nextUrl.searchParams.get('action') ?? '';
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Parse optional body
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // fine — not all actions send a body
  }

  // Fetch the queue item
  const { data: item, error: fetchErr } = await supabase
    .from('approval_queue')
    .select('*, clients(business_name, city, niche)')
    .eq('id', id)
    .single();

  if (fetchErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  // ── approve ────────────────────────────────────────────────────────────────
  if (action === 'approve') {
    const { error } = await supabase
      .from('approval_queue')
      .update({ status: 'approved', approved_by: 'operator', approved_at: now })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // For GBP posts: copy into gbp_posts so they appear in the GBP Posts tab
    if (item.action_type === 'gbp_post') {
      const data = (item.edited_content ?? item.content_data) as Record<string, unknown>;
      const { error: insertErr } = await supabase.from('gbp_posts').insert({
        client_id: item.client_id,
        content: String(data.post_text ?? ''),
        post_type: String(data.post_type ?? 'weekly'),
        status: 'scheduled',
        scheduled_date: item.scheduled_for ?? null,
        image_url: (data.photo_url as string | undefined) ?? null,
      });
      if (insertErr) {
        console.error('[approval-queue] gbp_posts insert failed:', insertErr.message);
      }
    }

    return NextResponse.json({ ok: true, status: 'approved' });
  }

  // ── reject ─────────────────────────────────────────────────────────────────
  if (action === 'reject') {
    const reason = String(body.reason ?? 'Rejected by operator');
    const { error } = await supabase
      .from('approval_queue')
      .update({ status: 'rejected', reject_reason: reason })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  // ── edit ───────────────────────────────────────────────────────────────────
  if (action === 'edit') {
    const newContent = body.content as Record<string, unknown> | undefined;
    if (!newContent) return NextResponse.json({ error: 'content required' }, { status: 400 });
    const { error } = await supabase
      .from('approval_queue')
      .update({ edited_content: newContent })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── publish / approve-and-publish ──────────────────────────────────────────
  if (action === 'publish' || action === 'approve-and-publish') {
    if (item.status === 'published') {
      return NextResponse.json({ error: 'Already published' }, { status: 409 });
    }

    // Approve first if needed
    if (action === 'approve-and-publish') {
      await supabase
        .from('approval_queue')
        .update({ status: 'approved', approved_by: 'operator', approved_at: now })
        .eq('id', id);
    }

    const data = (item.edited_content ?? item.content_data) as Record<string, unknown>;
    const actionType: string = item.action_type;

    // ── GBP post ─────────────────────────────────────────────────────────────
    if (actionType === 'gbp_post') {
      const postText = String(data.post_text ?? '');
      const useGhl = Boolean(data.use_ghl);
      const ghlLocationId = String(data.ghl_location_id ?? '');
      const ghlApiKey = String(data.ghl_api_key ?? '');
      const phone = String(data.phone ?? '');
      const postType = String(data.post_type ?? 'weekly');
      const clientId: string = item.client_id;

      if (useGhl && ghlLocationId && ghlApiKey) {
        const { success, postId, error: ghlErr } = await publishViaGhl(
          ghlLocationId, ghlApiKey, postText, phone,
        );

        if (!success) {
          await supabase
            .from('approval_queue')
            .update({ status: 'error', publish_result: ghlErr })
            .eq('id', id);
          return NextResponse.json({ error: ghlErr }, { status: 502 });
        }

        const result = `Published via GHL: ${postId}`;
        await Promise.all([
          supabase.from('approval_queue').update({
            status: 'published',
            published_at: now,
            publish_result: result,
          }).eq('id', id),
          supabase.from('gbp_posts').insert({
            client_id: clientId,
            content: postText,
            post_type: postType,
            status: 'posted',
            ghl_post_id: postId || null,
          }),
          supabase.from('outbound_log').insert({
            client_id: clientId,
            surface: 'gbp_post',
            recipient: ghlLocationId,
            subject: `GBP post (${postType})`,
            content: postText,
            sent_by: 'approval_queue',
            sent_at: now,
          }),
        ]);

        return NextResponse.json({ success: true, result });
      }

      // No GHL config — cannot publish without Railway for direct GBP API
      const errMsg = 'No GHL credentials on this post. Configure GHL location in client settings.';
      await supabase
        .from('approval_queue')
        .update({ status: 'error', publish_result: errMsg })
        .eq('id', id);
      return NextResponse.json({ error: errMsg }, { status: 422 });
    }

    // ── Other action types (email-based) ──────────────────────────────────────
    // friday_update, monthly_report, photo_reminder — require SendGrid which is
    // Railway-side for now. Return a clear error so operator knows what's needed.
    const errMsg = `Publishing ${actionType} requires the Railway backend (email send). Railway is currently down — fix Railway to publish this item type.`;
    return NextResponse.json({ error: errMsg }, { status: 503 });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const supabase = createServiceClient();

  const { data: item, error: fetchErr } = await supabase
    .from('approval_queue')
    .select('content_data')
    .eq('id', id)
    .single();

  if (fetchErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const newContentData = { ...(item.content_data as Record<string, unknown>), ...body };

  const { error: updateErr } = await supabase
    .from('approval_queue')
    .update({ content_data: newContentData })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, content_data: newContentData });
}

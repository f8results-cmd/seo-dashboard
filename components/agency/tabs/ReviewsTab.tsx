'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, MessageSquare, Mail, Smartphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

interface ReviewTemplates {
  sms_template: string;
  email_subject_template: string;
  email_body_template: string;
  sms_followup_template: string;
  gbp_review_url: string;
  review_request_guide: string;
}

interface Props {
  client: Client;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function TemplateCard({
  icon,
  title,
  subtitle,
  content,
  charCount,
  charLimit,
  isHtml = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  content: string;
  charCount?: number;
  charLimit?: number;
  isHtml?: boolean;
}) {
  const over = charLimit && charCount && charCount > charLimit;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[#1B2B6B]">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {charCount !== undefined && charLimit !== undefined && (
            <span className={`text-xs ${over ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              {charCount}/{charLimit} chars
            </span>
          )}
          <CopyButton text={content} />
        </div>
      </div>
      {isHtml ? (
        <div className="relative">
          <div
            className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4 border border-gray-100 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      ) : (
        <pre className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4 border border-gray-100 whitespace-pre-wrap font-sans">
          {content}
        </pre>
      )}
    </div>
  );
}

export default function ReviewsTab({ client }: Props) {
  const [templates, setTemplates] = useState<ReviewTemplates | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadTemplates();
  }, [client.id]);

  async function loadTemplates() {
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('website_data')
      .eq('id', client.id)
      .single();
    const wd = data?.website_data as Record<string, any> ?? {};
    setTemplates(wd.review_templates ?? null);
    setLoading(false);
  }

  async function triggerGeneration() {
    setGenerating(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? '';
      const res = await fetch(`${apiBase}/review-templates/${client.id}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Poll for completion (templates appear in website_data)
      let attempts = 0;
      while (attempts < 20) {
        await new Promise(r => setTimeout(r, 3000));
        const { data } = await supabase
          .from('clients')
          .select('website_data')
          .eq('id', client.id)
          .single();
        const wd = data?.website_data as Record<string, any> ?? {};
        if (wd.review_templates) {
          setTemplates(wd.review_templates);
          break;
        }
        attempts++;
      }
    } catch (err) {
      console.error('Failed to trigger review template generation:', err);
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const gbpUrl = templates?.gbp_review_url ?? '';
  const placeId = (client as any).google_place_id ?? '';
  const computedGbpUrl = gbpUrl || (placeId ? `https://search.google.com/local/writereview?placeid=${placeId}` : '');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Review Request Templates</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Copy these into GHL automations. Nothing is sent automatically.
          </p>
        </div>
        {computedGbpUrl && (
          <a
            href={computedGbpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B2B6B] hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            GBP Review Link
          </a>
        )}
      </div>

      {!templates ? (
        /* No templates yet */
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <MessageSquare className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">No review templates yet</p>
          <p className="text-xs text-gray-500 mb-5">
            Generate personalised review request templates for {client.business_name}.
          </p>
          <button
            onClick={triggerGeneration}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B2B6B] text-white text-sm font-medium rounded-lg hover:bg-[#1B2B6B]/90 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : 'Generate Templates'}
          </button>
        </div>
      ) : (
        <>
          {/* GBP Review URL */}
          {computedGbpUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-0.5">GBP Review URL</p>
                  <p className="text-sm text-blue-700 font-mono break-all">{computedGbpUrl}</p>
                </div>
                <CopyButton text={computedGbpUrl} />
              </div>
            </div>
          )}

          {/* SMS Template */}
          <TemplateCard
            icon={<Smartphone className="w-4 h-4" />}
            title="Initial SMS"
            subtitle="Send 3 hours after job completion"
            content={templates.sms_template}
            charCount={templates.sms_template?.length}
            charLimit={280}
          />

          {/* SMS Follow-up */}
          <TemplateCard
            icon={<Smartphone className="w-4 h-4" />}
            title="Follow-up SMS"
            subtitle="Send 3 days later if no review received"
            content={templates.sms_followup_template}
            charCount={templates.sms_followup_template?.length}
            charLimit={280}
          />

          {/* Email Subject */}
          <TemplateCard
            icon={<Mail className="w-4 h-4" />}
            title="Email Subject Line"
            subtitle="Send 24 hours after job completion"
            content={templates.email_subject_template}
            charCount={templates.email_subject_template?.length}
            charLimit={60}
          />

          {/* Email Body */}
          <TemplateCard
            icon={<Mail className="w-4 h-4" />}
            title="Email Body"
            content={templates.email_body_template}
            isHtml
          />

          {/* Setup Guide */}
          {templates.review_request_guide && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setGuideExpanded(v => !v)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900">GHL Workflow Setup Guide</span>
                <span className="text-lg text-gray-400">{guideExpanded ? '−' : '+'}</span>
              </button>
              {guideExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="mt-4 prose prose-sm max-w-none text-gray-700">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {templates.review_request_guide}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Regenerate */}
          <div className="flex justify-end">
            <button
              onClick={triggerGeneration}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <>
                  <span className="w-3 h-3 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
                  Regenerating...
                </>
              ) : 'Regenerate Templates'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

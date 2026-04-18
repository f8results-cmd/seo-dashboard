'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Client } from '@/lib/types';

interface NicheConfig {
  label: string;
  gbp_primary: string;
  gbp_secondary: string[];
  design_personality: string;
  hero_cta: string;
  content_opener: string;
  local_hook: string;
  keywords_template: string[];
}

// Strip HTML tags and decode basic entities
function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPrompt(client: Client, nicheConfig: NicheConfig | null): string {
  // Cast to any for fields not in the TS type but present in Supabase
  const c = client as unknown as Record<string, unknown>;

  const wd = (client.website_data ?? {}) as Record<string, unknown>;
  const pages = (wd.pages ?? {}) as Record<string, Record<string, unknown>>;
  const services = (wd.services ?? []) as Array<{
    title?: string;
    slug?: string;
    meta_description?: string;
    faqs?: Array<{ question: string; answer: string }>;
  }>;
  const gbpCatPages = (wd.gbp_category_pages ?? []) as Array<{
    title?: string;
    category_name?: string;
    slug?: string;
  }>;
  const gbpGuide = (wd.gbp_guide ?? {}) as Record<string, unknown>;
  const pageManifest = (wd.page_manifest ?? {}) as {
    pages?: Array<{
      url: string;
      page_type: string;
      h1?: string;
      title_tag?: string;
      meta_description?: string;
      word_count_target?: number;
    }>;
  };
  const serviceAreas = (wd.service_areas ?? (c.service_areas as string[] | undefined) ?? []) as string[];
  const seoData = (wd.seo ?? {}) as Record<string, unknown>;
  const keyword = (seoData.primary_keyword as string | undefined) ?? (c.primary_keyword as string | undefined) ?? '';
  const clientServices = (c.services as string[] | undefined) ?? [];
  const usps = (c.unique_selling_points as string[] | undefined) ?? [];
  const competitors = (c.competitors as string[] | undefined) ?? [];

  const lines: string[] = [];
  const D = '─'.repeat(60);
  const H = '═'.repeat(60);

  lines.push(H);
  lines.push(`AI STUDIO BRIEF — ${String(client.business_name ?? '').toUpperCase()}`);
  lines.push(H);
  lines.push('');

  // Business overview
  lines.push(D);
  lines.push('BUSINESS OVERVIEW');
  lines.push(D);
  lines.push(`Name:             ${client.business_name}`);
  lines.push(`Niche:            ${nicheConfig?.label ?? client.niche ?? 'Unknown'}`);
  lines.push(`City:             ${client.city ?? ''}${client.state ? ', ' + client.state : ''}`);
  if (c.suburb) lines.push(`Suburb:           ${c.suburb}`);
  if (client.address) lines.push(`Address:          ${client.address}`);
  if (client.phone) lines.push(`Phone:            ${client.phone}`);
  if (client.email) lines.push(`Email:            ${client.email}`);
  if (keyword) lines.push(`Primary keyword:  ${keyword}`);
  if (clientServices.length) lines.push(`Services:         ${clientServices.join(', ')}`);
  if (serviceAreas.length) lines.push(`Service areas:    ${serviceAreas.join(', ')}`);
  if (usps.length) lines.push(`USPs:             ${usps.join('; ')}`);
  if (competitors.length) lines.push(`Competitors:      ${competitors.join(', ')}`);
  if (client.live_url) lines.push(`Live URL:         ${client.live_url}`);
  lines.push('');

  // Niche personality
  if (nicheConfig) {
    lines.push(D);
    lines.push('BRAND PERSONALITY');
    lines.push(D);
    lines.push(`Design personality:  ${nicheConfig.design_personality}`);
    lines.push(`Hero CTA:            ${nicheConfig.hero_cta}`);
    lines.push(`GBP primary:         ${nicheConfig.gbp_primary}`);
    lines.push(`Content opener:      ${nicheConfig.content_opener}`);
    lines.push(`Local hook:          ${nicheConfig.local_hook}`);
    lines.push('');
    lines.push('Keyword templates:');
    nicheConfig.keywords_template.forEach((k) => lines.push(`  - ${k}`));
    lines.push('');
  }

  // Page manifest
  if ((pageManifest.pages ?? []).length > 0) {
    lines.push(D);
    lines.push('PAGE MANIFEST');
    lines.push(D);
    for (const p of pageManifest.pages!) {
      lines.push(`[${p.page_type.toUpperCase()}] ${p.url}`);
      if (p.h1) lines.push(`  H1:    ${p.h1}`);
      if (p.title_tag) lines.push(`  Title: ${p.title_tag}`);
      if (p.meta_description) lines.push(`  Meta:  ${p.meta_description}`);
      if (p.word_count_target) lines.push(`  Words: ~${p.word_count_target}`);
    }
    lines.push('');
  }

  // Core page excerpts
  const corePages: Array<[string, string]> = [
    ['homepage', 'HOMEPAGE'],
    ['about', 'ABOUT PAGE'],
    ['contact', 'CONTACT PAGE'],
  ];
  const hasAny = corePages.some(([key]) => pages[key]?.body_html);
  if (hasAny) {
    lines.push(D);
    lines.push('CORE PAGE CONTENT (excerpt)');
    lines.push(D);
    for (const [key, label] of corePages) {
      const page = pages[key];
      if (!page?.body_html) continue;
      const text = htmlToText(page.body_html as string).slice(0, 500);
      lines.push(`${label}:`);
      if (key === 'homepage' && page.hero_headline) {
        lines.push(`  Hero headline: ${page.hero_headline}`);
      }
      lines.push(`  ${text}${text.length === 500 ? '…' : ''}`);
      lines.push('');
    }
  }

  // Service pages
  if (services.length) {
    lines.push(D);
    lines.push(`SERVICE PAGES (${services.length})`);
    lines.push(D);
    services.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.title ?? 'Untitled'}`);
      if (s.slug) lines.push(`   URL: /services/${s.slug}`);
      if (s.meta_description) lines.push(`   Meta: ${s.meta_description}`);
      if ((s.faqs ?? []).length) {
        lines.push(`   FAQs (${s.faqs!.length}):`);
        s.faqs!.slice(0, 3).forEach((faq) => lines.push(`     Q: ${faq.question}`));
      }
    });
    lines.push('');
  }

  // GBP category pages
  if (gbpCatPages.length) {
    lines.push(D);
    lines.push(`GBP CATEGORY PAGES (${gbpCatPages.length})`);
    lines.push(D);
    gbpCatPages.forEach((p) => {
      lines.push(`- ${p.title ?? p.category_name ?? 'Untitled'}`);
      if (p.slug) lines.push(`  URL: /gbp/${p.slug}`);
    });
    lines.push('');
  }

  // GBP guide
  const gbpDesc = gbpGuide.description as string | undefined;
  const gbpPrimary = gbpGuide.primary_category as string | undefined;
  const gbpSecondary = (gbpGuide.secondary_categories ?? []) as string[];
  if (gbpPrimary || gbpDesc) {
    lines.push(D);
    lines.push('GBP GUIDE (generated)');
    lines.push(D);
    if (gbpPrimary) lines.push(`Primary category:     ${gbpPrimary}`);
    if (gbpSecondary.length) lines.push(`Secondary categories: ${gbpSecondary.join(', ')}`);
    if (gbpDesc) {
      lines.push('');
      lines.push('GBP Description (750 char limit):');
      lines.push(gbpDesc.slice(0, 750));
      if (gbpDesc.length > 750) lines.push('[TRUNCATED]');
    }
    lines.push('');
  }

  // Footer
  lines.push(H);
  lines.push(
    `Generated: ${new Date().toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`
  );
  lines.push(H);

  return lines.join('\n');
}

export default function WebsitePromptTab({ client }: { client: Client }) {
  const [nicheConfig, setNicheConfig] = useState<NicheConfig | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/niche-keys')
      .then((r) => r.json())
      .then((data: { config?: Record<string, NicheConfig> }) => {
        const cfg = data.config?.[client.niche ?? ''];
        if (cfg) setNicheConfig(cfg);
      })
      .catch(() => {});
  }, [client.niche]);

  const prompt = buildPrompt(client, nicheConfig);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [prompt]);

  const wordCount = prompt.split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">AI Studio Brief</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Copy-ready prompt for Claude / Gemini — full context for this client
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-gray-400">{wordCount.toLocaleString()} words</span>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-[#1B2B6B] text-white hover:bg-[#243580]'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  Copy Full Prompt
                </>
              )}
            </button>
          </div>
        </div>
        <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-4 overflow-auto max-h-[640px] whitespace-pre-wrap font-mono leading-relaxed">
          {prompt}
        </pre>
      </div>
    </div>
  );
}

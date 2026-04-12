'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { Client } from '@/lib/types';

function GBPSetupSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden animate-pulse">
          <div className="px-5 py-4 bg-gray-50 flex items-center justify-between">
            <div className="h-4 bg-gray-200 rounded w-40" />
            <div className="h-4 bg-gray-200 rounded w-4" />
          </div>
          <div className="px-5 py-4 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 border border-gray-200 rounded">
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-semibold text-gray-900 text-sm">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 py-4 space-y-3">{children}</div>}
    </div>
  );
}

export default function GBPSetupTab({ client }: { client: Client }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <GBPSetupSkeleton />;

  const wd = client.website_data as Record<string, unknown> ?? {};
  const gbpCategories = wd.gbp_categories as { primary: string; secondary: string[] } | undefined;
  const gbpServices = wd.gbp_services as Array<{ name: string; description: string }> | undefined;
  const pages = wd.pages as Record<string, { body_html?: string; meta_description?: string }> | undefined;
  const homepage = pages?.homepage;

  const description = (homepage?.meta_description ?? client.agency_notes ?? '').slice(0, 750);
  const primaryCat = gbpCategories?.primary ?? client.niche ?? '—';
  const secondaryCats = gbpCategories?.secondary ?? [];

  // Group services by category
  const services = client.website_data
    ? ((client.website_data as Record<string, unknown>).services as Array<{ title: string; parent_category: string; description?: string }> ?? [])
    : [];

  const servicesByCategory: Record<string, typeof services> = {};
  for (const svc of services) {
    const cat = svc.parent_category ?? 'General';
    if (!servicesByCategory[cat]) servicesByCategory[cat] = [];
    servicesByCategory[cat].push(svc);
  }

  const photoChecklist = [
    { label: 'Logo (250×250px min)', done: !!client.photos?.logo },
    { label: 'Cover photo (1080×608px)', done: !!client.photos?.cover },
    { label: 'Exterior / vehicle / equipment', done: !!client.photos?.exterior },
    { label: 'Owner / team photo', done: !!client.photos?.owner },
    { label: 'Work in progress #1', done: !!client.photos?.work1 },
    { label: 'Work in progress #2', done: !!client.photos?.work2 },
    { label: 'Before photo', done: !!client.photos?.before },
    { label: 'After photo', done: !!client.photos?.after },
  ];
  const photosUploaded = photoChecklist.filter(p => p.done).length;

  return (
    <div className="p-6 space-y-4">

      {/* 1 — Categories */}
      <Section title="1. Categories">
        <div>
          <p className="text-xs text-gray-500 mb-1">Primary Category</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 flex-1">{primaryCat}</span>
            <CopyBtn text={primaryCat} />
          </div>
        </div>
        {secondaryCats.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Secondary Categories</p>
            {secondaryCats.map((cat, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 flex-1">{cat}</span>
                <CopyBtn text={cat} />
              </div>
            ))}
            <CopyBtn text={[primaryCat, ...secondaryCats].join('\n')} />
          </div>
        )}
      </Section>

      {/* 2 — Business Description */}
      <Section title="2. Business Description">
        <div className="relative">
          <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded p-3 whitespace-pre-wrap">{description || 'No description yet — run content agent.'}</p>
          <div className={`text-xs mt-1 ${description.length > 750 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
            {description.length} / 750 characters{description.length > 750 && ' — too long!'}
          </div>
        </div>
        {description && <CopyBtn text={description} />}
      </Section>

      {/* 3 — GBP Services */}
      <Section title="3. GBP Services (30)">
        {gbpServices && gbpServices.length > 0 ? (
          <div className="space-y-2">
            {gbpServices.map((svc, i) => (
              <div key={i} className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{svc.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>
                </div>
                <CopyBtn text={`${svc.name}\n${svc.description}`} />
              </div>
            ))}
            <CopyBtn text={gbpServices.map(s => `${s.name}: ${s.description}`).join('\n\n')} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">No GBP services yet — run GBP agent.</p>
        )}
      </Section>

      {/* 4 — Photos Checklist */}
      <Section title={`4. Photos Checklist (${photosUploaded}/${photoChecklist.length} uploaded)`}>
        <div className="space-y-2">
          {photoChecklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className={`w-4 h-4 rounded-full flex-shrink-0 ${item.done ? 'bg-green-500' : 'bg-gray-200'}`} />
              <span className={`text-sm ${item.done ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 5 — Hours */}
      <Section title="5. Hours">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded" />
          <span>Hours set in Google Business Profile</span>
        </div>
      </Section>

      {/* 6 — GHL Connection Steps */}
      <Section title="6. GHL Connection Steps">
        <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
          <li>Log into your GHL sub-account</li>
          <li>Go to <strong>Reputation → Google Business Profile</strong></li>
          <li>Click <strong>Connect</strong> and sign in with Google</li>
          <li>Once connected, posts publish automatically every Wednesday</li>
        </ol>
        <div className="flex items-center gap-2 mt-2">
          <input type="checkbox" className="rounded" />
          <span className="text-sm text-gray-700">GBP connected in GHL</span>
        </div>
      </Section>

      {/* 7 — Weekly Photo Reminder */}
      <Section title="7. Weekly Photo Reminder">
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800 space-y-2">
          <p className="font-medium">Geotagging instructions for new photos:</p>
          <p><strong>iPhone:</strong> Location Services must be ON for Camera app. Go to Settings → Privacy → Location Services → Camera → While Using.</p>
          <p><strong>Android:</strong> Open Camera app → Settings → toggle Location tags ON.</p>
          <p className="text-xs text-blue-600 mt-2">Geotagged photos help associate your business location with search results.</p>
        </div>
      </Section>

      {/* 8 — What Figure 8 Handles */}
      <Section title="8. What Figure 8 Handles">
        <ul className="space-y-2 text-sm text-gray-700">
          {[
            'Weekly GBP post published every Wednesday automatically',
            'Citation building via LeadSnap (50+ directories)',
            'Website live on Vercel with SEO-optimised pages',
            'Monthly SEO report delivered to you',
            'Rank tracking and heatmap monitoring',
            'Review response drafting (coming soon)',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8622A] mt-2 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

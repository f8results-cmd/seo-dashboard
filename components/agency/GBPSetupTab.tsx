'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Client } from '@/lib/types';

interface NicheConfig {
  label: string;
  gbp_primary: string;
  gbp_secondary: string[];
  keywords_template: string[];
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        })
      }
      className={`flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded font-medium transition-colors ${
        copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied
        </>
      ) : (
        'Copy'
      )}
    </button>
  );
}

function SectionShell({
  title,
  doneKey,
  gbpSetup,
  onMarkDone,
  children,
}: {
  title: string;
  doneKey: string;
  gbpSetup: Record<string, unknown>;
  onMarkDone: (key: string, done: boolean) => void;
  children: React.ReactNode;
}) {
  const isDone = !!gbpSetup[doneKey];
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-6 ${isDone ? 'border-green-200' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <button
          onClick={() => onMarkDone(doneKey, !isDone)}
          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            isDone
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {isDone ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Done
            </>
          ) : (
            'Mark Done'
          )}
        </button>
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GBPSetupTab({ client }: { client: Client }) {
  const router = useRouter();
  const [nicheConfig, setNicheConfig] = useState<NicheConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const websiteData = (client.website_data ?? {}) as Record<string, unknown>;
  const gbpSetup = (websiteData.gbp_setup ?? {}) as Record<string, unknown>;
  const gbpGuide = (websiteData.gbp_guide ?? {}) as Record<string, unknown>;
  const services = (websiteData.services ?? []) as Array<{ title?: string; meta_description?: string }>;
  const photosChecklist = (
    gbpGuide.photo_checklist ??
    gbpGuide.photos_checklist ?? [
      'Exterior — front of business during business hours',
      'Interior — reception or main working area',
      'Team — owner and staff in uniform or work gear',
      'Work in progress — job site or service being performed',
      'Before and after — transformation shots',
      'Logo and signage',
      'Vehicles with branding',
      'Completed work — portfolio examples',
    ]
  ) as string[];

  useEffect(() => {
    fetch('/api/niche-keys')
      .then((r) => r.json())
      .then((data: { config?: Record<string, NicheConfig> }) => {
        const cfg = data.config?.[client.niche ?? ''];
        if (cfg) setNicheConfig(cfg);
      })
      .catch(() => {});
  }, [client.niche]);

  const markDone = useCallback(
    async (key: string, done: boolean) => {
      setSaving(true);
      const newSetup = { ...gbpSetup, [key]: done };
      try {
        await fetch(`/api/clients/${client.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website_data: { ...websiteData, gbp_setup: newSetup },
          }),
        });
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [client.id, gbpSetup, websiteData, router]
  );

  // Progress
  const sectionKeys = ['categories', 'description', 'services', 'photos', 'hours', 'reviews', 'ghl', 'qa', 'automated'];
  const doneCount = sectionKeys.filter((k) => !!gbpSetup[k]).length;

  // Generated description
  const gbpDescription = (gbpGuide.description as string | undefined) ?? '';
  const descCharCount = gbpDescription.length;

  // Q&A pairs from services
  const city = client.city ?? 'your area';
  const qaServices = services.slice(0, 5);
  const suggestedQAs = [
    {
      q: `Do you service ${city}?`,
      a: `Yes — we're based in ${city} and serve the surrounding suburbs. Contact us to confirm your area.`,
    },
    ...qaServices.map((s) => ({
      q: `Do you offer ${s.title?.toLowerCase() ?? 'this service'} in ${city}?`,
      a: `Yes, ${s.title ?? 'this service'} is one of our core offerings in ${city}. ${s.meta_description ?? ''}`.trim(),
    })),
    {
      q: 'How do I book an appointment?',
      a: `Call us directly or use the contact form on our website. We typically respond within a few hours.`,
    },
    {
      q: 'Are you licensed and insured?',
      a: `Yes, we are fully licensed and insured. We're happy to provide documentation on request.`,
    },
  ].slice(0, 7);

  // Review request template
  const reviewTemplate = `Hi [Customer Name],

Thanks for choosing ${client.business_name ?? 'us'} — we really appreciate your business!

If you're happy with the service, we'd love it if you could take 2 minutes to leave us a Google review. It helps other ${city} locals find us.

Leave a review here: [Your Google Review Link]

Thanks again,
[Your Name]
${client.business_name ?? ''}`;

  return (
    <div className="space-y-4">

      {/* Progress header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">GBP Setup Progress</h3>
          <span className="text-sm font-medium text-gray-500">
            {doneCount} / {sectionKeys.length} sections complete
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1B2B6B] rounded-full transition-all"
            style={{ width: `${(doneCount / sectionKeys.length) * 100}%` }}
          />
        </div>
        {saving && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
      </div>

      {/* 1. Categories */}
      <SectionShell title="1. Categories" doneKey="categories" gbpSetup={gbpSetup} onMarkDone={markDone}>
        <p className="text-xs text-gray-500 mb-3">
          Set these in GBP → <strong>Edit Profile → Business Category</strong>. One primary, up to 9 secondary.
        </p>
        {nicheConfig ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block text-xs bg-[#1B2B6B] text-white px-2 py-0.5 rounded font-medium">Primary</span>
              <span className="text-sm text-gray-800 flex-1">{nicheConfig.gbp_primary}</span>
              <CopyBtn text={nicheConfig.gbp_primary} />
            </div>
            <div className="border-t border-gray-50 pt-2 space-y-1.5">
              {nicheConfig.gbp_secondary.slice(0, 9).map((cat) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">Secondary</span>
                  <span className="text-sm text-gray-700 flex-1">{cat}</span>
                  <CopyBtn text={cat} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Loading niche config…</p>
        )}
      </SectionShell>

      {/* 2. Business Description */}
      <SectionShell title="2. Business Description" doneKey="description" gbpSetup={gbpSetup} onMarkDone={markDone}>
        <p className="text-xs text-gray-500 mb-3">
          Add this to GBP → <strong>Edit Profile → Business description</strong>. Max 750 characters.
        </p>
        {gbpDescription ? (
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-xs text-gray-400">
                {descCharCount} / 750 chars{descCharCount > 750 && ' — exceeds limit, truncate before adding'}
              </p>
              <CopyBtn text={gbpDescription.slice(0, 750)} />
            </div>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed border border-gray-100">
              {gbpDescription.slice(0, 750)}
              {descCharCount > 750 && <span className="text-red-400"> [truncated]</span>}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100">
            No description generated yet — run the content agent first.
          </p>
        )}
      </SectionShell>

      {/* 3. Services */}
      <SectionShell title="3. Services" doneKey="services" gbpSetup={gbpSetup} onMarkDone={markDone}>
        <p className="text-xs text-gray-500 mb-3">
          Add these under GBP → <strong>Edit Profile → Services</strong>. Description max 300 chars.
        </p>
        {services.length ? (
          <div className="space-y-2">
            {services.slice(0, 10).map((s, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="font-medium text-sm text-gray-800 flex-1">{s.title ?? 'Untitled'}</span>
                  <CopyBtn text={`${s.title ?? ''}\n${(s.meta_description ?? '').slice(0, 300)}`} />
                </div>
                {s.meta_description && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {s.meta_description.slice(0, 300)}
                    {s.meta_description.length > 300 && '…'}
                  </p>
                )}
              </div>
            ))}
            {services.length > 10 && (
              <p className="text-xs text-gray-400">+ {services.length - 10} more services</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100">
            No services generated yet — run the content agent first.
          </p>
        )}
      </SectionShell>

      {/* 4. Photos */}
      <SectionShell title="4. Photos Checklist" doneKey="photos" gbpSetup={gbpSetup} onMarkDone={markDone}>
        <p className="text-xs text-gray-500 mb-3">
          Upload via GBP → <strong>Photos → Add photos</strong>. Aim for 10+ high-quality images.
        </p>
        <ul className="space-y-2">
          {photosChecklist.map((photo) => (
            <li key={photo} className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {photo}
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* 5. Hours */}
      <SectionShell title="5. Business Hours" doneKey="hours" gbpSetup={gbpSetup} onMarkDone={markDone}>
        <p className="text-xs text-gray-500 mb-3">
          Set accurate hours in GBP → <strong>Edit Profile → Hours</strong>. Include public holiday hours if relevant.
        </p>
        <ul className="text-sm text-gray-600 space-y-1.5">
          <li className="flex gap-2">
            <span className="text-gray-400">→</span>
            Confirm hours with the client before setting
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">→</span>
            Set "More hours" for each service type if applicable
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">→</span>
            Mark special hours for public holidays in advance
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">→</span>
            24/7 or emergency availability should be stated clearly
          </li>
        </ul>
      </SectionShell>

      {/* 6. Review Strategy */}
      <SectionShell title="6. Review Strategy" doneKey="reviews" gbpSetup={gbpSetup} onMarkDone={markDone}>
        <p className="text-xs text-gray-500 mb-3">
          Send this template to the client to use when requesting reviews. Get your Google review shortlink from GBP → <strong>Ask for reviews</strong>.
        </p>
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-xs font-medium text-gray-600">Review request template:</p>
          <CopyBtn text={reviewTemplate} />
        </div>
        <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
          {reviewTemplate}
        </pre>
      </SectionShell>

      {/* 7. GHL Connection */}
      <SectionShell title="7. GHL Connection" doneKey="ghl" gbpSetup={gbpSetup} onMarkDone={markDone}>
        <p className="text-xs text-gray-500 mb-3">
          The GHL location ID enables automated weekly GBP posts. Set it in the Pipeline tab.
        </p>
        <div className="border border-gray-100 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">GHL Sub-account ID</span>
            {client.ghl_location_id ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Not set
              </span>
            )}
          </div>
          {client.ghl_location_id ? (
            <p className="text-xs font-mono text-gray-400">{client.ghl_location_id}</p>
          ) : (
            <p className="text-xs text-gray-400">
              Go to <strong>Pipeline tab → Connection Status → GHL Sub-account → Edit</strong> to add the location ID.
            </p>
          )}
        </div>
      </SectionShell>

      {/* 8. Q&A */}
      <SectionShell title="8. Q&amp;A" doneKey="qa" gbpSetup={gbpSetup} onMarkDone={markDone}>
        <p className="text-xs text-gray-500 mb-3">
          Add these as Q&As on the GBP listing. Go to the profile → <strong>Q&amp;A</strong> → ask and answer each yourself.
        </p>
        <div className="space-y-3">
          {suggestedQAs.map((qa, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-[#1B2B6B] flex-shrink-0 mt-0.5">Q</span>
                <p className="text-sm font-medium text-gray-800 flex-1">{qa.q}</p>
                <CopyBtn text={`Q: ${qa.q}\nA: ${qa.a}`} />
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-gray-400 flex-shrink-0 mt-0.5">A</span>
                <p className="text-sm text-gray-600">{qa.a}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      {/* 9. Automated Work */}
      <SectionShell title="9. Automated Work" doneKey="automated" gbpSetup={gbpSetup} onMarkDone={markDone}>
        <p className="text-xs text-gray-500 mb-3">
          Once the pipeline has run and GHL is connected, the platform handles the following automatically.
        </p>
        <ul className="space-y-3">
          {[
            {
              title: 'Weekly GBP posts',
              desc: 'Every Monday 9:00am — posts a new update to the GBP listing via GHL.',
              requires: 'GHL location ID set',
            },
            {
              title: 'Weekly review check',
              desc: 'Every Monday 9:30am — fetches new reviews and drafts AI responses for approval.',
              requires: 'GBP agent complete',
            },
            {
              title: 'Monthly blog post',
              desc: '1st of month 8:00am — generates and publishes a new blog post to the client\'s website.',
              requires: 'Website deployed',
            },
            {
              title: 'Monthly citation audit',
              desc: '1st of month 9:00am — checks citation consistency across AU directories.',
              requires: 'Citations submitted',
            },
            {
              title: 'Monthly SEO report',
              desc: '1st of month 8:30am — generates and emails a full SEO report to the client.',
              requires: 'Report agent complete',
            },
          ].map((item) => (
            <li key={item.title} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-[#1B2B6B] flex-shrink-0 mt-1.5" />
              <div>
                <p className="text-sm font-medium text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                <p className="text-xs text-gray-400 mt-0.5">Requires: {item.requires}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionShell>

    </div>
  );
}

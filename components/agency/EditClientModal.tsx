'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Client } from '@/lib/types';

interface NicheOption {
  key: string;
  label: string;
}

const FALLBACK_NICHES: NicheOption[] = [
  { key: 'ndis_provider', label: 'NDIS / Disability Support Provider' },
  { key: 'plumber', label: 'Plumber / Gas Fitter' },
  { key: 'electrician', label: 'Electrician' },
  { key: 'window_cleaning', label: 'Window Cleaning' },
  { key: 'used_car_dealer', label: 'Used Car Dealer' },
  { key: 'lawn_and_garden', label: 'Lawn & Garden / Landscaping' },
  { key: 'cleaning', label: 'Cleaning Service' },
  { key: 'accountant', label: 'Accountant / Bookkeeper' },
  { key: 'real_estate', label: 'Real Estate Agent' },
  { key: 'mortgage_broker', label: 'Mortgage Broker' },
];

interface EditClientModalProps {
  client: Client;
  onClose: () => void;
}

export default function EditClientModal({ client, onClose }: EditClientModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [niches, setNiches] = useState<NicheOption[]>(FALLBACK_NICHES);
  const [nicheOpen, setNicheOpen] = useState(false);
  const nicheRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/niche-keys')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.niches)) setNiches(d.niches); })
      .catch(() => { /* keep fallback */ });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (nicheRef.current && !nicheRef.current.contains(e.target as Node)) {
        setNicheOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [form, setForm] = useState({
    business_name: client.business_name ?? '',
    owner_name: client.owner_name ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    address: client.address ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    postcode: client.postcode ?? '',
    niche: client.niche ?? '',
    website_url: client.website_url ?? '',
    gbp_url: client.gbp_url ?? '',
    gbp_location_name: client.gbp_location_name ?? '',
    tagline: client.tagline ?? '',
    years_in_business: client.years_in_business?.toString() ?? '',
    review_count: client.review_count?.toString() ?? '',
    review_rating: client.review_rating?.toString() ?? '',
    brand_primary_color: client.brand_primary_color ?? '#1B2B6B',
    brand_accent_color: client.brand_accent_color ?? '#E8622A',
    ghl_location_id: client.ghl_location_id ?? '',
    ghl_api_key: client.ghl_api_key ?? '',
    ghl_webhook_url: client.ghl_webhook_url ?? '',
    google_maps_embed_url: client.google_maps_embed_url ?? '',
    google_place_id: client.google_place_id ?? '',
    google_tag_id: client.google_tag_id ?? '',
    skip_website: client.skip_website ?? false,
    auto_respond_reviews: client.auto_respond_reviews ?? false,
    blog_delivery: client.blog_delivery ?? 'auto-publish',
    agency_notes: client.agency_notes ?? '',
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        ...form,
        years_in_business: form.years_in_business ? parseInt(form.years_in_business) : null,
        review_count: form.review_count ? parseInt(form.review_count) : null,
        review_rating: form.review_rating ? parseFloat(form.review_rating) : null,
        owner_name: form.owner_name || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        postcode: form.postcode || null,
        niche: form.niche || null,
        website_url: form.website_url || null,
        gbp_url: form.gbp_url || null,
        gbp_location_name: form.gbp_location_name || null,
        tagline: form.tagline || null,
        ghl_location_id: form.ghl_location_id || null,
        ghl_api_key: form.ghl_api_key || null,
        ghl_webhook_url: form.ghl_webhook_url || null,
        google_maps_embed_url: form.google_maps_embed_url || null,
        google_place_id: form.google_place_id || null,
        google_tag_id: form.google_tag_id || null,
        agency_notes: form.agency_notes || null,
        blog_delivery: form.blog_delivery || null,
      };

      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Save failed');
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-gray-900">Edit Client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <Section title="Business Details">
            <Field label="Business Name" required>
              <input className={input} value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Owner Name">
                <input className={input} value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
              </Field>
              <Field label="Niche">
                <div ref={nicheRef} className="relative">
                  <input
                    className={input}
                    value={form.niche}
                    onChange={(e) => set('niche', e.target.value)}
                    onFocus={() => setNicheOpen(true)}
                    placeholder="e.g. ndis_provider"
                    autoComplete="off"
                  />
                  {nicheOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {niches.map((n) => (
                        <button
                          key={n.key}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault(); // keep focus on input so onBlur doesn't fire first
                            set('niche', n.key);
                            setNicheOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                            form.niche === n.key ? 'bg-navy-50 text-navy-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          <span className="font-mono text-xs text-gray-400 mr-2">{n.key}</span>
                          {n.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
            </div>
            <Field label="Tagline">
              <input className={input} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Years in Business">
                <input className={input} type="number" min="0" value={form.years_in_business} onChange={(e) => set('years_in_business', e.target.value)} />
              </Field>
              <Field label="Review Count">
                <input className={input} type="number" min="0" value={form.review_count} onChange={(e) => set('review_count', e.target.value)} placeholder="e.g. 47" />
              </Field>
              <Field label="Review Rating">
                <input className={input} type="number" min="1" max="5" step="0.1" value={form.review_rating} onChange={(e) => set('review_rating', e.target.value)} placeholder="e.g. 4.8" />
              </Field>
            </div>
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email" required>
                <input className={input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className={input} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
            </div>
            <Field label="Address">
              <input className={input} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City">
                <input className={input} value={form.city} onChange={(e) => set('city', e.target.value)} />
              </Field>
              <Field label="State">
                <input className={input} value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="e.g. SA" />
              </Field>
              <Field label="Postcode">
                <input className={input} value={form.postcode} onChange={(e) => set('postcode', e.target.value)} placeholder="e.g. 5000" />
              </Field>
            </div>
          </Section>

          {/* Branding */}
          <Section title="Branding">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Primary Colour">
                <div className="flex items-center gap-3">
                  <input type="color" className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0.5"
                    value={form.brand_primary_color} onChange={(e) => set('brand_primary_color', e.target.value)} />
                  <input className={`${input} font-mono`} value={form.brand_primary_color}
                    onChange={(e) => set('brand_primary_color', e.target.value)} placeholder="#1B2B6B" />
                </div>
              </Field>
              <Field label="Accent Colour">
                <div className="flex items-center gap-3">
                  <input type="color" className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0.5"
                    value={form.brand_accent_color} onChange={(e) => set('brand_accent_color', e.target.value)} />
                  <input className={`${input} font-mono`} value={form.brand_accent_color}
                    onChange={(e) => set('brand_accent_color', e.target.value)} placeholder="#E8622A" />
                </div>
              </Field>
            </div>
          </Section>

          {/* Web */}
          <Section title="Online Presence">
            <Field label="Website URL">
              <input className={input} value={form.website_url} onChange={(e) => set('website_url', e.target.value)} placeholder="https://example.com.au" />
            </Field>
            <Field label="GBP URL">
              <input className={input} value={form.gbp_url} onChange={(e) => set('gbp_url', e.target.value)} placeholder="https://business.google.com/..." />
            </Field>
            <Field label="GBP Location Name" hint="Format: accounts/{id}/locations/{id}">
              <input className={input} value={form.gbp_location_name} onChange={(e) => set('gbp_location_name', e.target.value)} placeholder="accounts/1234/locations/5678" />
            </Field>
          </Section>

          {/* GoHighLevel */}
          <Section title="GoHighLevel">
            <div className="grid grid-cols-2 gap-4">
              <Field label="GHL Location ID">
                <input className={input} value={form.ghl_location_id} onChange={(e) => set('ghl_location_id', e.target.value)} />
              </Field>
              <Field label="GHL API Key">
                <input className={input} type="password" value={form.ghl_api_key} onChange={(e) => set('ghl_api_key', e.target.value)} />
              </Field>
            </div>
            <Field label="GHL Webhook URL" hint="Used for GBP post scheduling via GoHighLevel">
              <input className={input} value={form.ghl_webhook_url} onChange={(e) => set('ghl_webhook_url', e.target.value)} placeholder="https://..." />
            </Field>
          </Section>

          {/* Google */}
          <Section title="Google">
            <Field label="Google Maps Embed URL">
              <input className={input} value={form.google_maps_embed_url} onChange={(e) => set('google_maps_embed_url', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Google Place ID">
                <input className={input} value={form.google_place_id} onChange={(e) => set('google_place_id', e.target.value)} />
              </Field>
              <Field label="Google Tag ID">
                <input className={input} value={form.google_tag_id} onChange={(e) => set('google_tag_id', e.target.value)} placeholder="G-XXXXXXXXXX" />
              </Field>
            </div>
          </Section>

          {/* Pipeline Settings */}
          <Section title="Pipeline Settings">
            <Toggle
              label="Website managed by Figure8 Results"
              description="Turn off if the client manages their own website"
              checked={!form.skip_website}
              onChange={(v) => set('skip_website', !v)}
            />
            {!form.skip_website ? (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Blog delivery method</p>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit_blog_delivery"
                      value="auto-publish"
                      checked={form.blog_delivery === 'auto-publish'}
                      onChange={() => set('blog_delivery', 'auto-publish')}
                    />
                    <span className="text-sm text-gray-700">Auto-publish to website</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit_blog_delivery"
                      value="email"
                      checked={form.blog_delivery === 'email'}
                      onChange={() => set('blog_delivery', 'email')}
                    />
                    <span className="text-sm text-gray-700">Email for manual upload</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-sm text-amber-700">Pipeline will skip website build — blog posts will be emailed for manual upload.</p>
              </div>
            )}
            <Toggle
              label="Auto-respond to reviews"
              description="Automatically post AI-drafted responses to new reviews"
              checked={form.auto_respond_reviews}
              onChange={(v) => set('auto_respond_reviews', v)}
            />
          </Section>

          {/* Notes */}
          <Section title="Agency Notes">
            <textarea
              className={`${input} resize-none`}
              rows={4}
              value={form.agency_notes}
              onChange={(e) => set('agency_notes', e.target.value)}
              placeholder="Internal notes about this client..."
            />
          </Section>

          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 bg-navy-500 text-white text-sm font-medium rounded-lg hover:bg-navy-600 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const input = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-transparent';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-navy-500' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

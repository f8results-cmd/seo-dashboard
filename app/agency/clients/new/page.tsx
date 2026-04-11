'use client';

import { useState } from 'react';
import Link from 'next/link';

interface FormData {
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  niche: string;
  website_url: string;
  gbp_url: string;
  gbp_location_name: string;
  tagline: string;
  years_in_business: string;
  review_count: string;
  review_rating: string;
  brand_primary_color: string;
  brand_accent_color: string;
  ghl_location_id: string;
  ghl_api_key: string;
  ghl_webhook_url: string;
  google_maps_embed_url: string;
  google_place_id: string;
  google_tag_id: string;
  skip_website: boolean;
  auto_respond_reviews: boolean;
  blog_delivery: string;
  wp_url: string;
  wp_username: string;
  wp_app_password: string;
  agency_notes: string;
}

const INITIAL: FormData = {
  business_name: '', owner_name: '', email: '', phone: '',
  address: '', city: '', state: 'SA', postcode: '', niche: '',
  website_url: '', gbp_url: '', gbp_location_name: '', tagline: '',
  years_in_business: '', review_count: '', review_rating: '',
  brand_primary_color: '#1B2B6B', brand_accent_color: '#E8622A',
  ghl_location_id: '', ghl_api_key: '', ghl_webhook_url: '',
  google_maps_embed_url: '', google_place_id: '', google_tag_id: '',
  skip_website: false, auto_respond_reviews: false, blog_delivery: 'auto-publish',
  wp_url: '', wp_username: '', wp_app_password: '',
  agency_notes: '',
};

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const NICHES = [
  'plumber', 'electrician', 'window cleaning', 'automotive',
  'cleaning', 'landscaping', 'painter', 'carpenter', 'mechanic',
  'dentist', 'physio', 'restaurant', 'retail', 'other',
];

export default function NewClientPage() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newClientId, setNewClientId] = useState<string | null>(null);

  function update(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...form,
        years_in_business: form.years_in_business ? parseInt(form.years_in_business) : null,
        review_count: form.review_count ? parseInt(form.review_count) : null,
        review_rating: form.review_rating ? parseFloat(form.review_rating) : null,
        // Clear WP credentials when website is not managed by F8
        wp_url: form.skip_website ? null : (form.wp_url || null),
        wp_username: form.skip_website ? null : (form.wp_username || null),
        wp_app_password: form.skip_website ? null : (form.wp_app_password || null),
      };

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to create client');
        setLoading(false);
        return;
      }

      setNewClientId(data.client.id);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  if (newClientId) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Client Added</h2>
          <p className="text-gray-500 text-sm mb-6">
            {form.business_name} has been saved with status <strong>pending</strong>.<br />
            Run the pipeline from the client page when ready.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/agency/clients/${newClientId}`}
              className="px-5 py-2.5 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-600 transition-colors"
            >
              View Client
            </Link>
            <Link
              href="/agency/clients"
              className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Back to Clients
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/agency/clients" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add New Client</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Info */}
        <Section title="Business Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Business Name" required>
              <input type="text" required value={form.business_name} onChange={(e) => update('business_name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Niche" required>
              <select required value={form.niche} onChange={(e) => update('niche', e.target.value)} className={inputCls}>
                <option value="">Select niche…</option>
                {NICHES.map((n) => (
                  <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label="Owner Name">
              <input type="text" value={form.owner_name} onChange={(e) => update('owner_name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Years in Business">
              <input type="number" min={0} value={form.years_in_business} onChange={(e) => update('years_in_business', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Review Count">
              <input type="number" min={0} value={form.review_count} onChange={(e) => update('review_count', e.target.value)} placeholder="e.g. 47" className={inputCls} />
            </Field>
            <Field label="Review Rating">
              <input type="number" min={1} max={5} step={0.1} value={form.review_rating} onChange={(e) => update('review_rating', e.target.value)} placeholder="e.g. 4.8" className={inputCls} />
            </Field>
            <Field label="Tagline" className="sm:col-span-2">
              <input type="text" value={form.tagline} onChange={(e) => update('tagline', e.target.value)} placeholder="Short tagline for the business" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Contact */}
        <Section title="Contact Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email" required>
              <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="04XX XXX XXX" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Location */}
        <Section title="Location">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Street Address" className="sm:col-span-2">
              <input type="text" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Street address" className={inputCls} />
            </Field>
            <Field label="City">
              <input type="text" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="e.g. Adelaide" className={inputCls} />
            </Field>
            <Field label="State">
              <select value={form.state} onChange={(e) => update('state', e.target.value)} className={inputCls}>
                {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Postcode">
              <input type="text" value={form.postcode} onChange={(e) => update('postcode', e.target.value)} placeholder="e.g. 5000" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Online */}
        <Section title="Online Presence">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Website URL">
              <input type="url" value={form.website_url} onChange={(e) => update('website_url', e.target.value)} placeholder="https://" className={inputCls} />
            </Field>
            <Field label="Google Business Profile URL">
              <input type="url" value={form.gbp_url} onChange={(e) => update('gbp_url', e.target.value)} placeholder="https://maps.google.com/…" className={inputCls} />
            </Field>
            <Field label="GBP Location Name" hint="Format: accounts/{id}/locations/{id}" className="sm:col-span-2">
              <input type="text" value={form.gbp_location_name} onChange={(e) => update('gbp_location_name', e.target.value)} placeholder="accounts/1234/locations/5678" className={inputCls} />
            </Field>
            <Field label="Google Place ID" hint="Find this in the Google Maps URL for their business">
              <input type="text" value={form.google_place_id} onChange={(e) => update('google_place_id', e.target.value)} placeholder="ChIJ…" className={inputCls} />
            </Field>
            <Field label="Google Tag ID">
              <input type="text" value={form.google_tag_id} onChange={(e) => update('google_tag_id', e.target.value)} placeholder="G-XXXXXXXXXX" className={inputCls} />
            </Field>
            <Field label="Google Maps Embed URL" className="sm:col-span-2">
              <input type="text" value={form.google_maps_embed_url} onChange={(e) => update('google_maps_embed_url', e.target.value)} placeholder="https://www.google.com/maps/embed?pb=…" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Branding */}
        <Section title="Branding">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Primary Colour">
              <div className="flex gap-2">
                <input type="color" value={form.brand_primary_color} onChange={(e) => update('brand_primary_color', e.target.value)} className="h-10 w-12 rounded border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                <input type="text" value={form.brand_primary_color} onChange={(e) => update('brand_primary_color', e.target.value)} className={`${inputCls} flex-1`} placeholder="#1B2B6B" />
              </div>
            </Field>
            <Field label="Accent Colour">
              <div className="flex gap-2">
                <input type="color" value={form.brand_accent_color} onChange={(e) => update('brand_accent_color', e.target.value)} className="h-10 w-12 rounded border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                <input type="text" value={form.brand_accent_color} onChange={(e) => update('brand_accent_color', e.target.value)} className={`${inputCls} flex-1`} placeholder="#E8622A" />
              </div>
            </Field>
          </div>
        </Section>

        {/* GHL */}
        <Section title="GoHighLevel Integration">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="GHL Location ID">
              <input type="text" value={form.ghl_location_id} onChange={(e) => update('ghl_location_id', e.target.value)} placeholder="e.g. RIFIicGZ5P3b3kEfLh2c" className={inputCls} />
            </Field>
            <Field label="GHL API Key">
              <input type="password" value={form.ghl_api_key} onChange={(e) => update('ghl_api_key', e.target.value)} className={inputCls} />
            </Field>
            <Field label="GHL Webhook URL" hint="Used for GBP post scheduling via GoHighLevel" className="sm:col-span-2">
              <input type="url" value={form.ghl_webhook_url} onChange={(e) => update('ghl_webhook_url', e.target.value)} placeholder="https://…" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Pipeline Settings */}
        <Section title="Pipeline Settings">
          <div className="space-y-4">
            <Toggle
              label="Website managed by Figure8 Results"
              description="Turn off if the client manages their own website"
              checked={!form.skip_website}
              onChange={(v) => update('skip_website', !v)}
            />
            {!form.skip_website ? (
              <div className="pl-1 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Blog delivery method</p>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="blog_delivery"
                        value="auto-publish"
                        checked={form.blog_delivery === 'auto-publish'}
                        onChange={() => update('blog_delivery', 'auto-publish')}
                        className="accent-[#1B2B6B]"
                      />
                      <span className="text-sm text-gray-700">Auto-publish to website</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="blog_delivery"
                        value="email"
                        checked={form.blog_delivery === 'email'}
                        onChange={() => update('blog_delivery', 'email')}
                        className="accent-[#1B2B6B]"
                      />
                      <span className="text-sm text-gray-700">Email for manual upload</span>
                    </label>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">WordPress Connection</p>
                  <Field label="WordPress URL">
                    <input
                      type="url"
                      value={form.wp_url}
                      onChange={(e) => update('wp_url', e.target.value)}
                      placeholder="https://yoursite.ghl-wordpress.com"
                      className={inputCls}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="WordPress Username">
                      <input
                        type="text"
                        value={form.wp_username}
                        onChange={(e) => update('wp_username', e.target.value)}
                        placeholder="admin"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="WordPress App Password">
                      <input
                        type="password"
                        value={form.wp_app_password}
                        onChange={(e) => update('wp_app_password', e.target.value)}
                        placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                        className={inputCls}
                      />
                    </Field>
                  </div>
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
              onChange={(v) => update('auto_respond_reviews', v)}
            />
          </div>
        </Section>

        {/* Notes */}
        <Section title="Agency Notes">
          <textarea
            rows={4}
            value={form.agency_notes}
            onChange={(e) => update('agency_notes', e.target.value)}
            placeholder="Any special requirements, context, or notes about this client…"
            className={`${inputCls} w-full`}
          />
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-orange text-white text-sm font-medium rounded-lg hover:bg-orange-500 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Saving…' : 'Add Client'}
          </button>
          <Link
            href="/agency/clients"
            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2B6B] focus:border-transparent bg-white';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, required, hint, className, children }: {
  label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
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
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#1B2B6B]' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

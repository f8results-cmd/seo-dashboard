'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Upload } from 'lucide-react';

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
  logo_url: string;
  google_maps_embed_url: string;
  google_tag_id: string;
  skip_website: boolean;
  auto_respond_reviews: boolean;
  blog_delivery: string;
  agency_notes: string;
  onboarding_date: string;
  // Website management
  manages_website: boolean;
  website_hosting: string;
  domain_registrar: string;
  domain_owner: string;
  webmaster_contact: string;
  can_make_changes: boolean;
  access_notes: string;
  // Hosting
  we_host_website: boolean;
  hosting_platform: string;
  hosting_cost_monthly: string;
  hosting_included_in_plan: boolean;
  external_hosting_location: string;
  // Image fallback
  use_fallback_images: boolean;
}

const INITIAL: FormData = {
  business_name: '', owner_name: '', email: '', phone: '',
  address: '', city: '', state: 'SA', postcode: '', niche: '',
  website_url: '', gbp_url: '', gbp_location_name: '', tagline: '',
  years_in_business: '', review_count: '', review_rating: '',
  brand_primary_color: '#1B2B6B', brand_accent_color: '#E8622A',
  ghl_location_id: '', ghl_api_key: '', ghl_webhook_url: '',
  google_maps_embed_url: '', google_tag_id: '',
  skip_website: false, auto_respond_reviews: false, blog_delivery: 'auto-publish',
  agency_notes: '', logo_url: '', onboarding_date: '',
  manages_website: true, website_hosting: '', domain_registrar: '', domain_owner: 'client',
  webmaster_contact: '', can_make_changes: false, access_notes: '',
  we_host_website: false, hosting_platform: '', hosting_cost_monthly: '',
  hosting_included_in_plan: false, external_hosting_location: '',
  use_fallback_images: true,
};

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

export default function NewClientPage() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newClientId, setNewClientId] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const supabase = createClient();

  const handleChange = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `onboard-logos/${Date.now()}-logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('client-photos')
      .upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('client-photos').getPublicUrl(path);
      handleChange('logo_url', publicUrl);
    }
    setLogoUploading(false);
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
              <input type="text" required value={form.business_name} onChange={(e) => handleChange('business_name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Niche" required>
              <input type="text" required value={form.niche} onChange={(e) => handleChange('niche', e.target.value)} placeholder="e.g. plumber, window cleaner, electrician" className={inputCls} />
            </Field>
            <Field label="Owner Name">
              <input type="text" value={form.owner_name} onChange={(e) => handleChange('owner_name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Years in Business">
              <input type="number" min={0} value={form.years_in_business} onChange={(e) => handleChange('years_in_business', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Review Count">
              <input type="number" min={0} value={form.review_count} onChange={(e) => handleChange('review_count', e.target.value)} placeholder="e.g. 47" className={inputCls} />
            </Field>
            <Field label="Review Rating">
              <input type="number" min={1} max={5} step={0.1} value={form.review_rating} onChange={(e) => handleChange('review_rating', e.target.value)} placeholder="e.g. 4.8" className={inputCls} />
            </Field>
            <Field label="Tagline" className="sm:col-span-2">
              <input type="text" value={form.tagline} onChange={(e) => handleChange('tagline', e.target.value)} placeholder="Short tagline for the business" className={inputCls} />
            </Field>
            <Field label="Onboarding Date" hint="Start date for rollout checklist" className="sm:col-span-2">
              <input type="date" value={form.onboarding_date} onChange={(e) => handleChange('onboarding_date', e.target.value)} className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Contact */}
        <Section title="Contact Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email" required>
              <input type="email" required value={form.email} onChange={(e) => handleChange('email', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="04XX XXX XXX" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Location */}
        <Section title="Location">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Street Address" className="sm:col-span-2">
              <input type="text" value={form.address} onChange={(e) => handleChange('address', e.target.value)} placeholder="Street address" className={inputCls} />
            </Field>
            <Field label="City">
              <input type="text" value={form.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="e.g. Adelaide" className={inputCls} />
            </Field>
            <Field label="State">
              <select value={form.state} onChange={(e) => handleChange('state', e.target.value)} className={inputCls}>
                {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Postcode">
              <input type="text" value={form.postcode} onChange={(e) => handleChange('postcode', e.target.value)} placeholder="e.g. 5000" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Online */}
        <Section title="Online Presence">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Website URL">
              <input type="url" value={form.website_url} onChange={(e) => handleChange('website_url', e.target.value)} placeholder="https://" className={inputCls} />
            </Field>
            <Field label="Google Business Profile URL">
              <input type="url" value={form.gbp_url} onChange={(e) => handleChange('gbp_url', e.target.value)} placeholder="https://maps.google.com/…" className={inputCls} />
            </Field>
            <Field label="GBP Location Name" hint="Format: accounts/{id}/locations/{id}" className="sm:col-span-2">
              <input type="text" value={form.gbp_location_name} onChange={(e) => handleChange('gbp_location_name', e.target.value)} placeholder="accounts/1234/locations/5678" className={inputCls} />
            </Field>
            <Field label="Google Tag ID">
              <input type="text" value={form.google_tag_id} onChange={(e) => handleChange('google_tag_id', e.target.value)} placeholder="G-XXXXXXXXXX" className={inputCls} />
            </Field>
            <Field label="Google Maps Embed URL" className="sm:col-span-2">
              <input type="text" value={form.google_maps_embed_url} onChange={(e) => handleChange('google_maps_embed_url', e.target.value)} placeholder="https://www.google.com/maps/embed?pb=…" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Branding */}
        <Section title="Branding">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Primary Colour">
              <div className="flex gap-2">
                <input type="color" value={form.brand_primary_color} onChange={(e) => handleChange('brand_primary_color', e.target.value)} className="h-10 w-12 rounded border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                <input type="text" value={form.brand_primary_color} onChange={(e) => handleChange('brand_primary_color', e.target.value)} className={`${inputCls} flex-1`} placeholder="#1B2B6B" />
              </div>
            </Field>
            <Field label="Accent Colour">
              <div className="flex gap-2">
                <input type="color" value={form.brand_accent_color} onChange={(e) => handleChange('brand_accent_color', e.target.value)} className="h-10 w-12 rounded border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                <input type="text" value={form.brand_accent_color} onChange={(e) => handleChange('brand_accent_color', e.target.value)} className={`${inputCls} flex-1`} placeholder="#E8622A" />
              </div>
            </Field>
            <Field label="Business Logo" hint="PNG, JPG, SVG — uploaded immediately on select" className="sm:col-span-2">
              {form.logo_url ? (
                <div className="flex items-center gap-4 mt-1">
                  <div className="h-12 w-32 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={form.logo_url} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <label className="flex items-center gap-1.5 text-sm text-[#E8622A] cursor-pointer hover:text-[#d05520]">
                    <Upload className="w-4 h-4" />
                    {logoUploading ? 'Uploading…' : 'Replace'}
                    <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }} />
                  </label>
                </div>
              ) : (
                <label className={`flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-[#E8622A] transition-colors ${logoUploading ? 'opacity-60' : ''}`}>
                  <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-500">{logoUploading ? 'Uploading…' : 'Upload business logo'}</span>
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" disabled={logoUploading} onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }} />
                </label>
              )}
            </Field>
          </div>
        </Section>

        {/* GHL */}
        <Section title="GoHighLevel Integration">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="GHL Location ID">
              <input type="text" value={form.ghl_location_id} onChange={(e) => handleChange('ghl_location_id', e.target.value)} placeholder="e.g. RIFIicGZ5P3b3kEfLh2c" className={inputCls} />
            </Field>
            <Field label="GHL API Key">
              <input type="password" value={form.ghl_api_key} onChange={(e) => handleChange('ghl_api_key', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Lead Webhook URL" hint="Paste the GHL inbound webhook for this client — contact form submissions POST here" className="sm:col-span-2">
              <input type="url" value={form.ghl_webhook_url} onChange={(e) => handleChange('ghl_webhook_url', e.target.value)} placeholder="https://…" className={inputCls} />
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
              onChange={(v) => handleChange('skip_website', !v)}
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
                        onChange={() => handleChange('blog_delivery', 'auto-publish')}
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
                        onChange={() => handleChange('blog_delivery', 'email')}
                        className="accent-[#1B2B6B]"
                      />
                      <span className="text-sm text-gray-700">Email for manual upload</span>
                    </label>
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
              onChange={(v) => handleChange('auto_respond_reviews', v)}
            />
            <Toggle
              label="Generate placeholder images if none uploaded?"
              description="ImageAgent fetches stock photos (Pexels) + AI hero (fal.ai) when client has no photos"
              checked={form.use_fallback_images}
              onChange={(v) => handleChange('use_fallback_images', v)}
            />
          </div>
        </Section>

        {/* Website Management */}
        <Section title="Website Management">
          <div className="space-y-4">
            <Toggle
              label="Do we manage their website?"
              description="We handle hosting, deployment, and domain for this client"
              checked={form.manages_website}
              onChange={(v) => handleChange('manages_website', v)}
            />
            {form.manages_website ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <Field label="Website hosting">
                  <input type="text" value={form.website_hosting} onChange={(e) => handleChange('website_hosting', e.target.value)} placeholder="e.g. Vercel, WP Engine, GoDaddy" className={inputCls} />
                </Field>
                <Field label="Domain registrar">
                  <input type="text" value={form.domain_registrar} onChange={(e) => handleChange('domain_registrar', e.target.value)} placeholder="e.g. GoDaddy, Namecheap, Crazy Domains" className={inputCls} />
                </Field>
                <Field label="Who owns the domain?" className="sm:col-span-2">
                  <div className="flex gap-6 mt-0.5">
                    {(['client', 'us', 'transferring'] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="domain_owner"
                          value={opt}
                          checked={form.domain_owner === opt}
                          onChange={() => handleChange('domain_owner', opt)}
                          className="accent-[#1B2B6B]"
                        />
                        <span className="text-sm text-gray-700 capitalize">
                          {opt === 'us' ? 'Us' : opt === 'transferring' ? 'Transferring' : 'Client'}
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Client's webmaster contact" className="sm:col-span-2">
                    <input type="text" value={form.webmaster_contact} onChange={(e) => handleChange('webmaster_contact', e.target.value)} placeholder="Name / email of whoever manages their site" className={inputCls} />
                  </Field>
                </div>
                <Toggle
                  label="Can we make changes?"
                  description="We have access to push updates to their site"
                  checked={form.can_make_changes}
                  onChange={(v) => handleChange('can_make_changes', v)}
                />
                <Field label="Access notes">
                  <textarea
                    rows={3}
                    value={form.access_notes}
                    onChange={(e) => handleChange('access_notes', e.target.value)}
                    placeholder="Login instructions, CMS type, any access caveats…"
                    className={`${inputCls} w-full`}
                  />
                </Field>
              </div>
            )}
          </div>
        </Section>

        {/* Hosting */}
        <Section title="Hosting">
          <div className="space-y-4">
            <Toggle
              label="Are we hosting their website?"
              description="We own the hosting account for this client's site"
              checked={form.we_host_website}
              onChange={(v) => handleChange('we_host_website', v)}
            />
            {form.we_host_website ? (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Hosting platform">
                    <input type="text" value={form.hosting_platform} onChange={(e) => handleChange('hosting_platform', e.target.value)} placeholder="e.g. Vercel, Netlify, Railway" className={inputCls} />
                  </Field>
                  <Field label="Hosting cost to us ($/mo)">
                    <input type="number" min={0} step={0.01} value={form.hosting_cost_monthly} onChange={(e) => handleChange('hosting_cost_monthly', e.target.value)} placeholder="e.g. 20" className={inputCls} />
                  </Field>
                </div>
                <Toggle
                  label="Hosting included in their plan?"
                  description="Cost is covered by their monthly retainer"
                  checked={form.hosting_included_in_plan}
                  onChange={(v) => handleChange('hosting_included_in_plan', v)}
                />
              </div>
            ) : (
              <div className="pt-1">
                <Field label="Where is it hosted?">
                  <input type="text" value={form.external_hosting_location} onChange={(e) => handleChange('external_hosting_location', e.target.value)} placeholder="e.g. GoDaddy, WP Engine, their own server" className={inputCls} />
                </Field>
              </div>
            )}
          </div>
        </Section>

        {/* Notes */}
        <Section title="Agency Notes">
          <textarea
            rows={4}
            value={form.agency_notes}
            onChange={(e) => handleChange('agency_notes', e.target.value)}
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

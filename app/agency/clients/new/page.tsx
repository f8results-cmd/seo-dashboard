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
  niche: string;
  website_url: string;
  gbp_url: string;
  tagline: string;
  years_in_business: string;
  brand_primary_color: string;
  brand_accent_color: string;
  ghl_location_id: string;
  ghl_api_key: string;
  notes: string;
}

const INITIAL: FormData = {
  business_name: '', owner_name: '', email: '', phone: '',
  address: '', city: '', state: 'SA', niche: '',
  website_url: '', gbp_url: '', tagline: '',
  years_in_business: '', brand_primary_color: '#1B2B6B',
  brand_accent_color: '#E8622A', ghl_location_id: '',
  ghl_api_key: '', notes: '',
};

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const NICHES = [
  'plumber', 'electrician', 'window cleaning', 'automotive',
  'cleaning', 'landscaping', 'other',
];

export default function NewClientPage() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newClientId, setNewClientId] = useState<string | null>(null);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
          </div>
        </Section>

        {/* Notes */}
        <Section title="Agency Notes">
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
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

function Field({ label, required, className, children }: {
  label: string; required?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

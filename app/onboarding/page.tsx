'use client';

import { useState } from 'react';


const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

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
  years_in_business: string;
  brand_primary_color: string;
  brand_accent_color: string;
  ghl_location_id: string;
  agency_notes: string;
}

const INITIAL: FormData = {
  business_name: '', owner_name: '', email: '', phone: '',
  address: '', city: '', state: 'SA', niche: '',
  website_url: '', gbp_url: '', years_in_business: '',
  brand_primary_color: '#1B2B6B', brand_accent_color: '#E8622A',
  ghl_location_id: '', agency_notes: '',
};

export default function OnboardingPage() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

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
        setError(data.error ?? 'Failed to save client');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Client added successfully.</h2>
          <p className="text-gray-500 text-sm">
            Run the pipeline from the agency dashboard.
          </p>
          <button
            onClick={() => { setSuccess(false); setForm(INITIAL); }}
            className="mt-6 text-sm text-navy-500 hover:underline"
            style={{ color: '#1B2B6B' }}
          >
            Add another client
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1B2B6B] text-white px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E8622A] rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">F8</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Figure8 Results</h1>
            <p className="text-blue-200 text-xs leading-tight">New Client Onboarding</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Info */}
          <Section title="Business Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Business Name" required>
                <input type="text" required value={form.business_name} onChange={(e) => update('business_name', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Niche" required>
                <input type="text" required value={form.niche} onChange={(e) => update('niche', e.target.value)} placeholder="e.g. plumber, window cleaner, electrician" className={inputCls} />
              </Field>
              <Field label="Owner Name">
                <input type="text" value={form.owner_name} onChange={(e) => update('owner_name', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Years in Business">
                <input type="number" min={0} value={form.years_in_business} onChange={(e) => update('years_in_business', e.target.value)} className={inputCls} />
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
                <input type="text" value={form.address} onChange={(e) => update('address', e.target.value)} className={inputCls} />
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
          <Section title="GoHighLevel">
            <Field label="GHL Location ID">
              <input type="text" value={form.ghl_location_id} onChange={(e) => update('ghl_location_id', e.target.value)} placeholder="e.g. RIFIicGZ5P3b3kEfLh2c" className={inputCls} />
            </Field>
          </Section>

          {/* Notes */}
          <Section title="Agency Notes">
            <textarea
              rows={4}
              value={form.agency_notes}
              onChange={(e) => update('agency_notes', e.target.value)}
              placeholder="Any special requirements, context, or agency_notes about this client…"
              className={`${inputCls} w-full`}
            />
          </Section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 bg-[#E8622A] text-white font-semibold rounded-xl hover:bg-[#D14E19] disabled:opacity-60 transition-colors text-base"
          >
            {loading ? 'Saving…' : 'Add Client'}
          </button>
        </form>
      </div>
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

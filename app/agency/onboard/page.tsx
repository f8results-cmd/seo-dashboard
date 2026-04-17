'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface FormData {
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  niche: string;
  years_in_business: string;
  tagline: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  website_url: string;
  gbp_url: string;
  ghl_location_id: string;
  ghl_webhook_url: string;
  agency_notes: string;
  brand_primary_color: string;
  brand_accent_color: string;
  google_place_id: string;
  google_tag_id: string;
  skip_website: boolean;
}

const EMPTY: FormData = {
  business_name: '',
  owner_name: '',
  email: '',
  phone: '',
  niche: '',
  years_in_business: '',
  tagline: '',
  address: '',
  city: '',
  state: '',
  postcode: '',
  website_url: '',
  gbp_url: '',
  ghl_location_id: '',
  ghl_webhook_url: '',
  agency_notes: '',
  brand_primary_color: '',
  brand_accent_color: '',
  google_place_id: '',
  google_tag_id: '',
  skip_website: false,
};


const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30';

// Defined OUTSIDE the page component — avoids remounts on every render
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function OnboardPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.business_name.trim() || !form.email.trim()) {
      setError('Business name and email are required.');
      return;
    }
    setSaving(true);
    setError('');

    const supabase = createClient();
    const { data, error: err } = await supabase.from('clients').insert({
      business_name:       form.business_name.trim(),
      owner_name:          form.owner_name.trim() || null,
      email:               form.email.trim(),
      phone:               form.phone.trim() || null,
      niche:               form.niche || null,
      years_in_business:   form.years_in_business ? parseInt(form.years_in_business) : null,
      tagline:             form.tagline.trim() || null,
      address:             form.address.trim() || null,
      city:                form.city.trim() || null,
      state:               form.state.trim() || null,
      postcode:            form.postcode.trim() || null,
      website_url:         form.website_url.trim() || null,
      gbp_url:             form.gbp_url.trim() || null,
      ghl_location_id:     form.ghl_location_id.trim() || null,
      ghl_webhook_url:     form.ghl_webhook_url.trim() || null,
      agency_notes:        form.agency_notes.trim() || null,
      brand_primary_color: form.brand_primary_color || null,
      brand_accent_color:  form.brand_accent_color || null,
      google_place_id:     form.google_place_id.trim() || null,
      google_tag_id:       form.google_tag_id.trim() || null,
      skip_website:        form.skip_website,
      status:              'pending',
    }).select('id').single();

    if (err || !data) {
      setError(err?.message ?? 'Failed to create client.');
      setSaving(false);
      return;
    }

    router.push(`/agency/clients/${data.id}`);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/agency/clients" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to clients
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Onboard New Client</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in what you have — you can update the rest later from the client detail page.</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Business info */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Business Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Business Name" required>
              <input type="text" value={form.business_name} onChange={e => handleChange('business_name', e.target.value)} placeholder="e.g. Smith Plumbing" required className={inputCls} />
            </Field>
            <Field label="Owner Name">
              <input type="text" value={form.owner_name} onChange={e => handleChange('owner_name', e.target.value)} placeholder="e.g. John Smith" className={inputCls} />
            </Field>
            <Field label="Email" required>
              <input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} placeholder="john@example.com" required className={inputCls} />
            </Field>
            <Field label="Phone">
              <input type="text" value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+61 4xx xxx xxx" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Niche">
              <input type="text" value={form.niche} onChange={e => handleChange('niche', e.target.value)} placeholder="e.g. plumber, window cleaner, electrician" className={inputCls} />
            </Field>
            <Field label="Years in Business">
              <input type="number" value={form.years_in_business} onChange={e => handleChange('years_in_business', e.target.value)} placeholder="e.g. 10" className={inputCls} />
            </Field>
          </div>
          <Field label="Tagline">
            <input type="text" value={form.tagline} onChange={e => handleChange('tagline', e.target.value)} placeholder="e.g. Perth's Most Trusted Plumber" className={inputCls} />
          </Field>
        </section>

        {/* Location */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Location</h2>
          <Field label="Street Address">
            <input type="text" value={form.address} onChange={e => handleChange('address', e.target.value)} placeholder="123 Main St" className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="City / Suburb">
              <input type="text" value={form.city} onChange={e => handleChange('city', e.target.value)} placeholder="Perth" className={inputCls} />
            </Field>
            <Field label="State">
              <input type="text" value={form.state} onChange={e => handleChange('state', e.target.value)} placeholder="WA" className={inputCls} />
            </Field>
            <Field label="Postcode">
              <input type="text" value={form.postcode} onChange={e => handleChange('postcode', e.target.value)} placeholder="6000" className={inputCls} />
            </Field>
          </div>
        </section>

        {/* Online presence */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Online Presence</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Existing Website URL">
              <input type="text" value={form.website_url} onChange={e => handleChange('website_url', e.target.value)} placeholder="https://..." className={inputCls} />
            </Field>
            <Field label="Google Business Profile URL">
              <input type="text" value={form.gbp_url} onChange={e => handleChange('gbp_url', e.target.value)} placeholder="https://maps.google.com/..." className={inputCls} />
            </Field>
          </div>
        </section>

        {/* Integrations */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Integrations <span className="text-xs font-normal text-gray-400">(optional — add later)</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="GHL Location ID">
              <input type="text" value={form.ghl_location_id} onChange={e => handleChange('ghl_location_id', e.target.value)} placeholder="abc123..." className={inputCls} />
            </Field>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Internal Notes</h2>
          <textarea
            value={form.agency_notes}
            onChange={e => handleChange('agency_notes', e.target.value)}
            placeholder="Any notes for the AI or team about this client…"
            rows={4}
            className={`${inputCls} resize-none`}
          />
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pb-6">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#E8622A] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#d05520] transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating client…' : 'Create Client'}
          </button>
          <Link href="/agency/clients" className="px-6 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

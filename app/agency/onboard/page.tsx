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
  address: string;
  city: string;
  state: string;
  postcode: string;
  niche: string;
  tagline: string;
  years_in_business: string;
  website_url: string;
  gbp_url: string;
  agency_notes: string;
  ghl_location_id: string;
  wp_url: string;
  wp_username: string;
  wp_app_password: string;
}

const EMPTY: FormData = {
  business_name: '', owner_name: '', email: '', phone: '',
  address: '', city: '', state: '', postcode: '',
  niche: '', tagline: '', years_in_business: '',
  website_url: '', gbp_url: '',
  agency_notes: '',
  ghl_location_id: '', wp_url: '', wp_username: '', wp_app_password: '',
};

const NICHES = [
  'plumber', 'electrician', 'hvac', 'roofer', 'landscaper', 'cleaner',
  'painter', 'concreter', 'tiler', 'carpenter', 'locksmith', 'pest_control',
  'pool_service', 'solar', 'other',
];

export default function OnboardPage() {
  const router = useRouter();
  const [form, setForm]     = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(key: keyof FormData, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

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
      business_name:    form.business_name.trim(),
      owner_name:       form.owner_name.trim() || null,
      email:            form.email.trim(),
      phone:            form.phone.trim() || null,
      address:          form.address.trim() || null,
      city:             form.city.trim() || null,
      state:            form.state.trim() || null,
      postcode:         form.postcode.trim() || null,
      niche:            form.niche || null,
      tagline:          form.tagline.trim() || null,
      years_in_business: form.years_in_business ? parseInt(form.years_in_business) : null,
      website_url:      form.website_url.trim() || null,
      gbp_url:          form.gbp_url.trim() || null,
      agency_notes:     form.agency_notes.trim() || null,
      ghl_location_id:  form.ghl_location_id.trim() || null,
      wp_url:           form.wp_url.trim() || null,
      wp_username:      form.wp_username.trim() || null,
      wp_app_password:  form.wp_app_password.trim() || null,
      status:           'pending',
    }).select('id').single();

    if (err || !data) {
      setError(err?.message ?? 'Failed to create client.');
      setSaving(false);
      return;
    }

    router.push(`/agency/clients/${data.id}`);
  }

  function Field({ label, fieldKey, type = 'text', placeholder = '', required = false }: {
    label: string; fieldKey: keyof FormData; type?: string; placeholder?: string; required?: boolean;
  }) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
        <input
          type={type}
          value={form[fieldKey]}
          onChange={e => set(fieldKey, e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
        />
      </div>
    );
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
            <Field label="Business Name" fieldKey="business_name" required placeholder="e.g. Smith Plumbing" />
            <Field label="Owner Name" fieldKey="owner_name" placeholder="e.g. John Smith" />
            <Field label="Email" fieldKey="email" type="email" required placeholder="john@example.com" />
            <Field label="Phone" fieldKey="phone" placeholder="+61 4xx xxx xxx" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Niche</label>
              <select
                value={form.niche}
                onChange={e => set('niche', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              >
                <option value="">Select niche…</option>
                {NICHES.map(n => <option key={n} value={n}>{n.replace('_', ' ')}</option>)}
              </select>
            </div>
            <Field label="Years in Business" fieldKey="years_in_business" type="number" placeholder="e.g. 10" />
          </div>
          <Field label="Tagline" fieldKey="tagline" placeholder="e.g. Perth's Most Trusted Plumber" />
        </section>

        {/* Location */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Location</h2>
          <Field label="Street Address" fieldKey="address" placeholder="123 Main St" />
          <div className="grid grid-cols-3 gap-4">
            <Field label="City / Suburb" fieldKey="city" placeholder="Perth" />
            <Field label="State" fieldKey="state" placeholder="WA" />
            <Field label="Postcode" fieldKey="postcode" placeholder="6000" />
          </div>
        </section>

        {/* Online presence */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Online Presence</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Existing Website URL" fieldKey="website_url" placeholder="https://..." />
            <Field label="Google Business Profile URL" fieldKey="gbp_url" placeholder="https://maps.google.com/..." />
          </div>
        </section>

        {/* Integrations */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Integrations <span className="text-xs font-normal text-gray-400">(optional — add later)</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="GHL Location ID" fieldKey="ghl_location_id" placeholder="abc123..." />
            <Field label="WordPress URL" fieldKey="wp_url" placeholder="https://wp.example.com" />
            <Field label="WP Username" fieldKey="wp_username" placeholder="admin" />
            <Field label="WP App Password" fieldKey="wp_app_password" type="password" placeholder="••••••••••••" />
          </div>
        </section>

        {/* Notes */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Internal Notes</h2>
          <textarea
            value={form.agency_notes}
            onChange={e => set('agency_notes', e.target.value)}
            placeholder="Any notes for the AI or team about this client…"
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 resize-none"
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

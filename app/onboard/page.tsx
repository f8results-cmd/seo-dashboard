'use client';

import { useState } from 'react';

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
  service_areas: string;
  notes: string;
}

const EMPTY: FormData = {
  business_name: '', owner_name: '', email: '', phone: '',
  address: '', city: '', state: '', postcode: '',
  niche: '', tagline: '', years_in_business: '',
  website_url: '', gbp_url: '',
  service_areas: '', notes: '',
};

const NICHES = [
  { value: 'plumber',      label: 'Plumber' },
  { value: 'electrician',  label: 'Electrician' },
  { value: 'hvac',         label: 'HVAC / Air Conditioning' },
  { value: 'roofer',       label: 'Roofer' },
  { value: 'landscaper',   label: 'Landscaper / Gardener' },
  { value: 'cleaner',      label: 'Cleaner' },
  { value: 'painter',      label: 'Painter' },
  { value: 'concreter',    label: 'Concreter' },
  { value: 'tiler',        label: 'Tiler' },
  { value: 'carpenter',    label: 'Carpenter / Builder' },
  { value: 'locksmith',    label: 'Locksmith' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'pool_service', label: 'Pool Service' },
  { value: 'solar',        label: 'Solar / Energy' },
  { value: 'other',        label: 'Other' },
];

export default function PublicOnboardPage() {
  const [form, setForm]       = useState<FormData>(EMPTY);
  const [step, setStep]       = useState<'form' | 'success'>('form');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  function set(key: keyof FormData, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.business_name.trim() || !form.email.trim() || !form.city.trim()) {
      setError('Please fill in your business name, email, and city.');
      return;
    }
    setSaving(true);
    setError('');

    const res = await fetch('/api/public/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? 'Something went wrong. Please try again.');
      setSaving(false);
      return;
    }

    setStep('success');
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h2>
          <p className="text-gray-500">We've received your details. Our team will be in touch within 1 business day to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#1a2744] rounded-2xl mb-4">
            <span className="text-white font-bold text-xl">F8</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Get Started</h1>
          <p className="text-gray-500 mt-2">Tell us about your business and we'll build your SEO presence.</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {/* Business info */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Your Business</h2>

            <div className="space-y-1">
              <label className="text-sm text-gray-600 font-medium">Business Name <span className="text-red-400">*</span></label>
              <input
                value={form.business_name}
                onChange={e => set('business_name', e.target.value)}
                placeholder="e.g. Smith Plumbing"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-600 font-medium">Your Name</label>
                <input
                  value={form.owner_name}
                  onChange={e => set('owner_name', e.target.value)}
                  placeholder="John Smith"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600 font-medium">Years in Business</label>
                <input
                  type="number"
                  min="0"
                  value={form.years_in_business}
                  onChange={e => set('years_in_business', e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-600 font-medium">Trade / Industry</label>
              <select
                value={form.niche}
                onChange={e => set('niche', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              >
                <option value="">Select your trade…</option>
                {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-600 font-medium">Tagline / What you're known for</label>
              <input
                value={form.tagline}
                onChange={e => set('tagline', e.target.value)}
                placeholder="e.g. Perth's Most Trusted Plumber"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Contact</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-600 font-medium">Email <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="john@example.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600 font-medium">Phone</label>
                <input
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+61 4xx xxx xxx"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Location</h2>
            <div className="space-y-1">
              <label className="text-sm text-gray-600 font-medium">Street Address</label>
              <input
                value={form.address}
                onChange={e => set('address', e.target.value)}
                placeholder="123 Main Street"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1 space-y-1">
                <label className="text-sm text-gray-600 font-medium">City <span className="text-red-400">*</span></label>
                <input
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                  placeholder="Perth"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600 font-medium">State</label>
                <input
                  value={form.state}
                  onChange={e => set('state', e.target.value)}
                  placeholder="WA"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600 font-medium">Postcode</label>
                <input
                  value={form.postcode}
                  onChange={e => set('postcode', e.target.value)}
                  placeholder="6000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-600 font-medium">Service Areas</label>
              <input
                value={form.service_areas}
                onChange={e => set('service_areas', e.target.value)}
                placeholder="e.g. Perth, Fremantle, Joondalup, Rockingham"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              />
            </div>
          </div>

          {/* Online */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Online Presence <span className="text-xs font-normal text-gray-400">(optional)</span></h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-600 font-medium">Existing Website</label>
                <input
                  value={form.website_url}
                  onChange={e => set('website_url', e.target.value)}
                  placeholder="https://www.example.com.au"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600 font-medium">Google Business Profile</label>
                <input
                  value={form.gbp_url}
                  onChange={e => set('gbp_url', e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Anything else we should know?</h2>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Tell us anything important about your business, competitors, or what you're hoping to achieve…"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#E8622A] text-white py-4 rounded-2xl text-base font-semibold hover:bg-[#d05520] transition-colors disabled:opacity-50"
          >
            {saving ? 'Submitting…' : 'Submit & Get Started'}
          </button>

          <p className="text-xs text-center text-gray-400 pb-8">
            Your information is kept private and never shared with third parties.
          </p>
        </form>
      </div>
    </div>
  );
}

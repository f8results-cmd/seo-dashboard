'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

interface NicheOption { key: string; label: string; }

const FALLBACK_NICHES: NicheOption[] = [
  { key: 'car_detailing',   label: 'Car Detailing' },
  { key: 'ndis_provider',   label: 'NDIS / Disability Support Provider' },
  { key: 'used_car_dealer', label: 'Used Car Dealer' },
  { key: 'window_cleaning', label: 'Window Cleaning' },
  { key: 'lawn_and_garden', label: 'Lawn & Garden / Landscaping' },
  { key: 'mortgage_broker', label: 'Mortgage Broker' },
  { key: 'real_estate',     label: 'Real Estate Agent' },
  { key: 'plumber',         label: 'Plumber / Gas Fitter' },
  { key: 'electrician',     label: 'Electrician' },
  { key: 'cleaning',        label: 'Cleaning Service' },
  { key: 'accountant',      label: 'Accountant / Bookkeeper' },
];

const STATUS_OPTIONS = ['pending', 'active', 'complete', 'error', 'inactive'] as const;
const BLOG_DELIVERY_OPTIONS = ['ghl', 'email', 'none'] as const;

const cls = {
  input: 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/30 focus:border-[#1B2B6B]/50 bg-white',
  label: 'block text-xs font-medium text-gray-600 mb-1',
  hint:  'text-xs text-gray-400 mt-1',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className={cls.label}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className={cls.hint}>{hint}</p>}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-[#1B2B6B]' : 'bg-gray-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
      type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      {message}
    </div>
  );
}

type FormState = {
  // Business
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  niche: string;
  years_in_business: string;
  tagline: string;
  status: string;
  // Online presence
  website_url: string;
  live_url: string;
  gbp_url: string;
  gbp_location_name: string;
  google_place_id: string;
  google_maps_embed_url: string;
  github_repo: string;
  // Branding
  brand_primary_color: string;
  brand_accent_color: string;
  logo_url: string;
  // Reviews
  review_count: string;
  review_rating: string;
  auto_respond_reviews: boolean;
  // Integrations
  ghl_location_id: string;
  ghl_api_key: string;
  ghl_webhook_url: string;
  google_tag_id: string;
  // Agency
  skip_website: boolean;
  blog_delivery: string;
  agency_notes: string;
};

const EMPTY: FormState = {
  business_name: '', owner_name: '', email: '', phone: '',
  address: '', city: '', state: '', postcode: '',
  niche: '', years_in_business: '', tagline: '', status: 'pending',
  website_url: '', live_url: '', gbp_url: '', gbp_location_name: '',
  google_place_id: '', google_maps_embed_url: '', github_repo: '',
  brand_primary_color: '#1B2B6B', brand_accent_color: '#E8622A', logo_url: '',
  review_count: '', review_rating: '', auto_respond_reviews: false,
  ghl_location_id: '', ghl_api_key: '', ghl_webhook_url: '', google_tag_id: '',
  skip_website: false, blog_delivery: 'ghl', agency_notes: '',
};

function clientToForm(c: Client): FormState {
  return {
    business_name:        c.business_name ?? '',
    owner_name:           c.owner_name ?? '',
    email:                c.email ?? '',
    phone:                c.phone ?? '',
    address:              c.address ?? '',
    city:                 c.city ?? '',
    state:                c.state ?? '',
    postcode:             c.postcode ?? '',
    niche:                c.niche ?? '',
    years_in_business:    c.years_in_business?.toString() ?? '',
    tagline:              c.tagline ?? '',
    status:               c.status ?? 'pending',
    website_url:          c.website_url ?? '',
    live_url:             c.live_url ?? '',
    gbp_url:              c.gbp_url ?? '',
    gbp_location_name:    c.gbp_location_name ?? '',
    google_place_id:      c.google_place_id ?? '',
    google_maps_embed_url: c.google_maps_embed_url ?? '',
    github_repo:          c.github_repo ?? '',
    brand_primary_color:  c.brand_primary_color ?? '#1B2B6B',
    brand_accent_color:   c.brand_accent_color ?? '#E8622A',
    logo_url:             c.logo_url ?? '',
    review_count:         c.review_count?.toString() ?? '',
    review_rating:        c.review_rating?.toString() ?? '',
    auto_respond_reviews: c.auto_respond_reviews ?? false,
    ghl_location_id:      c.ghl_location_id ?? '',
    ghl_api_key:          c.ghl_api_key ?? '',
    ghl_webhook_url:      c.ghl_webhook_url ?? '',
    google_tag_id:        c.google_tag_id ?? '',
    skip_website:         c.skip_website ?? false,
    blog_delivery:        c.blog_delivery ?? 'ghl',
    agency_notes:         c.agency_notes ?? '',
  };
}

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [niches, setNiches]     = useState<NicheOption[]>(FALLBACK_NICHES);
  const [form, setForm]         = useState<FormState>(EMPTY);
  const [businessName, setBusinessName] = useState('');

  const supabase = createClient();

  useEffect(() => {
    fetch('/api/niche-keys')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.niches)) setNiches(d.niches); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setToast({ message: 'Could not load client', type: 'error' });
        } else {
          const c = data as Client;
          setForm(clientToForm(c));
          setBusinessName(c.business_name);
        }
        setLoading(false);
      });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Partial<Client> = {
        business_name:        form.business_name || undefined,
        owner_name:           form.owner_name || null,
        email:                form.email || undefined,
        phone:                form.phone || null,
        address:              form.address || null,
        city:                 form.city || null,
        state:                form.state || null,
        postcode:             form.postcode || null,
        niche:                form.niche || null,
        years_in_business:    form.years_in_business ? parseInt(form.years_in_business) : null,
        tagline:              form.tagline || null,
        status:               form.status as Client['status'],
        website_url:          form.website_url || null,
        live_url:             form.live_url || null,
        gbp_url:              form.gbp_url || null,
        gbp_location_name:    form.gbp_location_name || null,
        google_place_id:      form.google_place_id || null,
        google_maps_embed_url: form.google_maps_embed_url || null,
        github_repo:          form.github_repo || null,
        brand_primary_color:  form.brand_primary_color || null,
        brand_accent_color:   form.brand_accent_color || null,
        logo_url:             form.logo_url || null,
        review_count:         form.review_count ? parseInt(form.review_count) : null,
        review_rating:        form.review_rating ? parseFloat(form.review_rating) : null,
        auto_respond_reviews: form.auto_respond_reviews,
        ghl_location_id:      form.ghl_location_id || null,
        ghl_api_key:          form.ghl_api_key || null,
        ghl_webhook_url:      form.ghl_webhook_url || null,
        google_tag_id:        form.google_tag_id || null,
        skip_website:         form.skip_website,
        blog_delivery:        form.blog_delivery || null,
        agency_notes:         form.agency_notes || null,
      };

      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error ?? 'Save failed', type: 'error' });
        return;
      }

      setBusinessName(form.business_name);
      setToast({ message: 'Client saved', type: 'success' });
    } catch {
      setToast({ message: 'Network error — could not save', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-28" />
            {[...Array(3)].map((_, j) => <div key={j} className="h-9 bg-gray-100 rounded" />)}
          </div>
        ))}
      </div>
    );
  }

  const notesLen = form.agency_notes.length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-20">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href={`/agency/clients/${id}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to client
        </Link>
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 bg-[#1B2B6B] text-white text-sm font-medium rounded-lg hover:bg-[#152259] disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Edit Client</h1>
        <p className="text-sm text-gray-500 mt-0.5">{businessName}</p>
      </div>

      {/* ── Business Details ── */}
      <Section title="Business Details">
        <Field label="Business Name" required>
          <input className={cls.input} value={form.business_name}
            onChange={e => set('business_name', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner Name">
            <input className={cls.input} value={form.owner_name}
              onChange={e => set('owner_name', e.target.value)} />
          </Field>
          <Field label="Status">
            <select className={cls.input} value={form.status}
              onChange={e => set('status', e.target.value)}>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" required>
            <input className={cls.input} type="email" value={form.email}
              onChange={e => set('email', e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={cls.input} value={form.phone}
              onChange={e => set('phone', e.target.value)} placeholder="+61 4XX XXX XXX" />
          </Field>
        </div>

        <Field label="Address">
          <input className={cls.input} value={form.address}
            onChange={e => set('address', e.target.value)} />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="City">
            <input className={cls.input} value={form.city}
              onChange={e => set('city', e.target.value)} />
          </Field>
          <Field label="State">
            <input className={cls.input} value={form.state}
              onChange={e => set('state', e.target.value)} placeholder="e.g. SA" />
          </Field>
          <Field label="Postcode">
            <input className={cls.input} value={form.postcode}
              onChange={e => set('postcode', e.target.value)} placeholder="e.g. 5000" />
          </Field>
        </div>

        <Field label="Niche">
          <select className={cls.input} value={form.niche}
            onChange={e => set('niche', e.target.value)}>
            <option value="">— Select niche —</option>
            {niches.map(n => <option key={n.key} value={n.key}>{n.label}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Years in Business">
            <input className={cls.input} type="number" min="0" value={form.years_in_business}
              onChange={e => set('years_in_business', e.target.value)} />
          </Field>
          <Field label="Tagline">
            <input className={cls.input} value={form.tagline}
              onChange={e => set('tagline', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* ── Online Presence ── */}
      <Section title="Online Presence">
        <Field label="Existing Website URL">
          <input className={cls.input} type="url" value={form.website_url}
            onChange={e => set('website_url', e.target.value)} placeholder="https://example.com.au" />
        </Field>
        <Field label="Live URL" hint="The deployed Figure8 site URL">
          <input className={cls.input} type="url" value={form.live_url}
            onChange={e => set('live_url', e.target.value)} placeholder="https://clientsite.com" />
        </Field>
        <Field label="GitHub Repo" hint="Auto-set by deploy agent">
          <input className={cls.input} value={form.github_repo}
            onChange={e => set('github_repo', e.target.value)} placeholder="f8results-cmd/client-slug" />
        </Field>
        <Field label="Google Business Profile URL">
          <input className={cls.input} type="url" value={form.gbp_url}
            onChange={e => set('gbp_url', e.target.value)} placeholder="https://business.google.com/..." />
        </Field>
        <Field label="GBP Location Name" hint="Exact name as it appears in Google Business Profile">
          <input className={cls.input} value={form.gbp_location_name}
            onChange={e => set('gbp_location_name', e.target.value)} />
        </Field>
        <Field label="Google Place ID">
          <input className={cls.input} value={form.google_place_id}
            onChange={e => set('google_place_id', e.target.value)} placeholder="ChIJ..." />
        </Field>
        <Field label="Google Maps Embed URL" hint="Used for the embedded map on the website">
          <input className={cls.input} type="url" value={form.google_maps_embed_url}
            onChange={e => set('google_maps_embed_url', e.target.value)} placeholder="https://www.google.com/maps/embed?pb=..." />
        </Field>
      </Section>

      {/* ── Branding ── */}
      <Section title="Branding">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary Colour">
            <div className="flex items-center gap-3">
              <input type="color"
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0.5 shrink-0"
                value={form.brand_primary_color}
                onChange={e => set('brand_primary_color', e.target.value)} />
              <input className={`${cls.input} font-mono`} value={form.brand_primary_color}
                onChange={e => set('brand_primary_color', e.target.value)} placeholder="#1B2B6B" />
            </div>
          </Field>
          <Field label="Accent Colour">
            <div className="flex items-center gap-3">
              <input type="color"
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0.5 shrink-0"
                value={form.brand_accent_color}
                onChange={e => set('brand_accent_color', e.target.value)} />
              <input className={`${cls.input} font-mono`} value={form.brand_accent_color}
                onChange={e => set('brand_accent_color', e.target.value)} placeholder="#E8622A" />
            </div>
          </Field>
        </div>
        <Field label="Logo URL">
          <input className={cls.input} type="url" value={form.logo_url}
            onChange={e => set('logo_url', e.target.value)} placeholder="https://..." />
          {form.logo_url && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.logo_url} alt="Logo preview"
                className="h-16 max-w-[200px] object-contain rounded border border-gray-100 bg-gray-50 p-2"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
        </Field>
      </Section>

      {/* ── Reviews ── */}
      <Section title="Reviews">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Review Count">
            <input className={cls.input} type="number" min="0" value={form.review_count}
              onChange={e => set('review_count', e.target.value)} placeholder="e.g. 47" />
          </Field>
          <Field label="Average Rating">
            <input className={cls.input} type="number" min="1" max="5" step="0.1" value={form.review_rating}
              onChange={e => set('review_rating', e.target.value)} placeholder="e.g. 4.8" />
          </Field>
        </div>
        <Toggle
          label="Auto-respond to reviews"
          description="Automatically generate AI responses for new Google reviews"
          checked={form.auto_respond_reviews}
          onChange={v => set('auto_respond_reviews', v)}
        />
      </Section>

      {/* ── Integrations ── */}
      <Section title="Integrations">
        <div className="grid grid-cols-2 gap-4">
          <Field label="GHL Sub-account ID">
            <input className={cls.input} value={form.ghl_location_id}
              onChange={e => set('ghl_location_id', e.target.value)} />
          </Field>
          <Field label="Google Tag ID">
            <input className={cls.input} value={form.google_tag_id}
              onChange={e => set('google_tag_id', e.target.value)} placeholder="G-XXXXXXXXXX" />
          </Field>
        </div>
        <Field label="GHL API Key">
          <input className={cls.input} type="password" value={form.ghl_api_key}
            onChange={e => set('ghl_api_key', e.target.value)} placeholder="Bearer token" />
        </Field>
        <Field label="GHL Webhook URL">
          <input className={cls.input} type="url" value={form.ghl_webhook_url}
            onChange={e => set('ghl_webhook_url', e.target.value)} placeholder="https://..." />
        </Field>
      </Section>

      {/* ── Agency ── */}
      <Section title="Agency">
        <Toggle
          label="Website managed by Figure8 Results"
          description="Turn off if the client manages their own website"
          checked={!form.skip_website}
          onChange={v => set('skip_website', !v)}
        />

        <Field label="Blog Delivery" hint="How blog posts are delivered to the client">
          <select className={cls.input} value={form.blog_delivery}
            onChange={e => set('blog_delivery', e.target.value)}>
            {BLOG_DELIVERY_OPTIONS.map(o => (
              <option key={o} value={o}>
                {o === 'ghl' ? 'GoHighLevel (GHL)' : o === 'email' ? 'Email' : 'None'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Agency Notes">
          <textarea
            className={`${cls.input} resize-none`}
            rows={8}
            value={form.agency_notes}
            onChange={e => set('agency_notes', e.target.value)}
            placeholder="Services offered, target keywords, service suburbs, years in business, local differentiators, brand voice, anything the pipeline needs to know…"
          />
          <div className="flex items-start justify-between gap-3 mt-1.5">
            {notesLen === 0 ? <span /> :
             notesLen < 200 ? (
               <p className="text-xs text-amber-600 flex items-start gap-1.5">
                 <svg className="w-3.5 h-3.5 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                 </svg>
                 Add more detail — include services, target keywords, suburbs, years in business, and local differentiators
               </p>
             ) : (
               <p className="text-xs text-green-600 flex items-center gap-1.5">
                 <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                 </svg>
                 Good detail
               </p>
             )}
            <span className="text-xs text-gray-400 shrink-0">{notesLen} chars</span>
          </div>
        </Field>
      </Section>

      {/* ── Bottom save bar ── */}
      <div className="flex justify-between items-center pt-2 pb-8">
        <button
          type="button"
          onClick={() => router.push(`/agency/clients/${id}`)}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-[#1B2B6B] text-white text-sm font-medium rounded-lg hover:bg-[#152259] disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

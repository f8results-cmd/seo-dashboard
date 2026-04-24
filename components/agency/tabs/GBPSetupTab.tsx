'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { Client } from '@/lib/types';

function GBPSetupSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden animate-pulse">
          <div className="px-5 py-4 bg-gray-50 flex items-center justify-between">
            <div className="h-4 bg-gray-200 rounded w-40" />
            <div className="h-4 bg-gray-200 rounded w-4" />
          </div>
          <div className="px-5 py-4 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 border border-gray-200 rounded">
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-semibold text-gray-900 text-sm">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 py-4 space-y-3">{children}</div>}
    </div>
  );
}

export default function GBPSetupTab({ client }: { client: Client }) {
  const [mounted, setMounted] = useState(false);

  // ── Secondary categories state ────────────────────────────────────────────
  const [categories, setCategories] = useState<string[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [newName, setNewName] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenMsg, setRegenMsg] = useState('');
  const [regenError, setRegenError] = useState('');

  useEffect(() => {
    setMounted(true);
    fetch(`/api/clients/${client.id}/categories`)
      .then(r => r.json())
      .then(data => {
        setCategories(data.categories ?? []);
        setCatsLoading(false);
      })
      .catch(() => setCatsLoading(false));
  }, [client.id]);

  if (!mounted) return <GBPSetupSkeleton />;

  // ── Read-only data from website_data ─────────────────────────────────────
  const wd = client.website_data as Record<string, unknown> ?? {};
  const gbpGuide = wd.gbp_guide as Record<string, unknown> | undefined;
  // gbp_agent writes to website_data.gbp_services; report_agent writes them inside gbp_guide.services
  const gbpServices = (wd.gbp_services as Array<{ name: string; description: string }> | undefined)
    ?? (gbpGuide?.services as Array<{ name: string; description: string }> | undefined);

  // Use the agent-generated GBP description (stored at website_data.gbp_guide.description).
  // Fallback chain: gbp_guide.description → agency_notes → empty (never homepage meta).
  const description = ((gbpGuide?.description as string) ?? client.agency_notes ?? '').slice(0, 750);
  const primaryCat = client.gbp_primary_category ?? client.niche ?? '—';

  const photoChecklist = [
    { label: 'Logo (250×250px min)',        done: !!client.photos?.logo },
    { label: 'Cover photo (1080×608px)',    done: !!client.photos?.cover },
    { label: 'Exterior / vehicle / equipment', done: !!client.photos?.exterior },
    { label: 'Owner / team photo',          done: !!client.photos?.owner },
    { label: 'Work in progress #1',         done: !!client.photos?.work1 },
    { label: 'Work in progress #2',         done: !!client.photos?.work2 },
    { label: 'Before photo',                done: !!client.photos?.before },
    { label: 'After photo',                 done: !!client.photos?.after },
  ];
  const photosUploaded = photoChecklist.filter(p => p.done).length;

  // ── Category helpers ──────────────────────────────────────────────────────

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= categories.length) return;
    const updated = [...categories];
    [updated[index], updated[next]] = [updated[next], updated[index]];
    setCategories(updated);
    setDirty(true);
  }

  function removeCategory(index: number) {
    setCategories(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  function addCategory() {
    const trimmed = newName.trim();
    if (!trimmed || categories.includes(trimmed)) { setNewName(''); return; }
    setCategories(prev => [...prev, trimmed]);
    setNewName('');
    setDirty(true);
  }

  async function saveCategories() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`/api/clients/${client.id}/categories`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setDirty(false);
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    setRegenError('');
    setRegenMsg('');
    try {
      const res = await fetch(`/api/clients/${client.id}/categories/regenerate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Research failed');
      setRegenMsg('Research started — categories will be written in ~30 seconds. Reload this page to see results.');
    } catch (err: unknown) {
      setRegenError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setRegenerating(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">

      {/* 1 — Categories */}
      <Section title="1. Categories">
        {/* Primary */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Primary Category</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 flex-1">{primaryCat}</span>
            <CopyBtn text={primaryCat} />
          </div>
        </div>

        {/* Secondary — interactive */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Secondary Categories</p>
            <div className="flex items-center gap-2">
              {dirty && (
                <button
                  onClick={saveCategories}
                  disabled={saving}
                  className="px-3 py-1 bg-[#E8622A] text-white text-xs font-medium rounded hover:bg-[#d05520] transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
              {saveMsg && (
                <span className={`text-xs font-medium ${saveMsg === 'Saved' ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>

          {catsLoading ? (
            <div className="space-y-1.5">
              {[...Array(3)].map((_, i) => <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No secondary categories yet. Add below or use Regenerate.</p>
          ) : (
            <ul className="space-y-1.5">
              {categories.map((cat, i) => (
                <li key={`${cat}-${i}`} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-3 py-2">
                  {/* Up/down */}
                  <div className="flex flex-col gap-0 flex-shrink-0">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                      aria-label="Move up">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === categories.length - 1}
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                      aria-label="Move down">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 w-4 text-center flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-800">{cat}</span>
                  <CopyBtn text={cat} />
                  <button type="button" onClick={() => removeCategory(i)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 ml-1" aria-label="Remove">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
              placeholder="Add category…"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
            />
            <button type="button" onClick={addCategory} disabled={!newName.trim()}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors disabled:opacity-40">
              Add
            </button>
          </div>

          {/* Regenerate */}
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">Ask Claude to suggest categories for this niche + location</p>
            <button type="button" onClick={regenerate} disabled={regenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded hover:border-gray-400 transition-colors disabled:opacity-60">
              {regenerating && (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {regenerating ? 'Generating…' : 'Regenerate'}
            </button>
          </div>

          {regenError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mt-2">{regenError}</p>
          )}

          {regenMsg && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mt-2">{regenMsg}</p>
          )}

          {categories.length > 0 && !dirty && (
            <div className="mt-2">
              <CopyBtn text={[primaryCat, ...categories].join('\n')} />
            </div>
          )}
        </div>
      </Section>

      {/* 2 — Business Description */}
      <Section title="2. Business Description">
        <div className="relative">
          <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded p-3 whitespace-pre-wrap">{description || 'No description yet — run GBP agent to generate.'}</p>
          <div className={`text-xs mt-1 ${description.length > 750 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
            {description.length} / 750 characters{description.length > 750 && ' — too long!'}
          </div>
        </div>
        {description && <CopyBtn text={description} />}
      </Section>

      {/* 3 — GBP Services */}
      <Section title="3. GBP Services (30)">
        {gbpServices && gbpServices.length > 0 ? (
          <div className="space-y-2">
            {gbpServices.map((svc, i) => (
              <div key={i} className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{svc.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>
                </div>
                <CopyBtn text={`${svc.name}\n${svc.description}`} />
              </div>
            ))}
            <CopyBtn text={gbpServices.map(s => `${s.name}: ${s.description}`).join('\n\n')} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">No GBP services yet — run GBP agent.</p>
        )}
      </Section>

      {/* 4 — Photos Checklist */}
      <Section title={`4. Photos Checklist (${photosUploaded}/${photoChecklist.length} uploaded)`}>
        <div className="space-y-2">
          {photoChecklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className={`w-4 h-4 rounded-full flex-shrink-0 ${item.done ? 'bg-green-500' : 'bg-gray-200'}`} />
              <span className={`text-sm ${item.done ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 5 — Hours */}
      <Section title="5. Hours">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded" />
          <span>Hours set in Google Business Profile</span>
        </div>
      </Section>

      {/* 6 — GHL Connection Steps */}
      <Section title="6. GHL Connection Steps">
        <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
          <li>Log into your GHL sub-account</li>
          <li>Go to <strong>Reputation → Google Business Profile</strong></li>
          <li>Click <strong>Connect</strong> and sign in with Google</li>
          <li>Once connected, posts publish automatically every Wednesday</li>
        </ol>
        <div className="flex items-center gap-2 mt-2">
          <input type="checkbox" className="rounded" />
          <span className="text-sm text-gray-700">GBP connected in GHL</span>
        </div>
      </Section>

      {/* 7 — Weekly Photo Reminder */}
      <Section title="7. Weekly Photo Reminder">
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800 space-y-2">
          <p className="font-medium">Geotagging instructions for new photos:</p>
          <p><strong>iPhone:</strong> Location Services must be ON for Camera app. Go to Settings → Privacy → Location Services → Camera → While Using.</p>
          <p><strong>Android:</strong> Open Camera app → Settings → toggle Location tags ON.</p>
          <p className="text-xs text-blue-600 mt-2">Geotagged photos help associate your business location with search results.</p>
        </div>
      </Section>

      {/* 8 — What Figure 8 Handles */}
      <Section title="8. What Figure 8 Handles">
        <ul className="space-y-2 text-sm text-gray-700">
          {[
            'Weekly GBP post published every Wednesday automatically',
            'Citation building via LeadSnap (50+ directories)',
            'Website live on Vercel with SEO-optimised pages',
            'Monthly SEO report delivered to you',
            'Rank tracking and heatmap monitoring',
            'Review response drafting (coming soon)',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8622A] mt-2 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

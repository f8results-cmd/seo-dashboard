'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight, Upload, X, AlertTriangle, Check, Play, Loader2, FileText, Image } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSetupValidation } from '@/lib/setupStatus';
import GBPSetupGuide from './GBPSetupGuide';
import type { Client } from '@/lib/types';

const RAILWAY = 'https://figure8-seo-platform-production.up.railway.app';

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({
  title, children, defaultOpen = true, badge,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
          {badge}
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && <div className="px-5 py-4 space-y-3">{children}</div>}
    </div>
  );
}

function SaveBtn({
  dirty, saving, onSave, saved,
}: {
  dirty: boolean; saving: boolean; onSave: () => void; saved: boolean;
}) {
  if (!dirty && !saved) return null;
  return (
    <button
      onClick={onSave}
      disabled={saving || !dirty}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-60 ${
        saved && !dirty
          ? 'bg-green-100 text-green-700 border border-green-200'
          : 'bg-[#E8622A] text-white hover:bg-[#d05520]'
      }`}
    >
      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved && !dirty ? <Check className="w-3 h-3" /> : null}
      {saving ? 'Saving…' : saved && !dirty ? 'Saved' : 'Save'}
    </button>
  );
}

// ── Category autocomplete ─────────────────────────────────────────────────────

function CategoryInput({
  value, onChange, label, placeholder,
}: {
  value: string; onChange: (v: string) => void; label: string; placeholder: string;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inTaxonomy, setInTaxonomy] = useState<boolean | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); setShowDropdown(false); return; }
    try {
      const res = await fetch(`${RAILWAY}/api/gbp-categories/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      function extractName(item: unknown): string {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>;
          return typeof o.category_name === 'string' ? o.category_name
            : typeof o.name === 'string' ? o.name
            : '';
        }
        return '';
      }
      const rawItems: unknown[] = Array.isArray(data) ? data.slice(0, 10) : (Array.isArray(data?.results) ? data.results.slice(0, 10) : []);
      const matches: string[] = rawItems.map(extractName).filter(Boolean);
      setResults(matches);
      setShowDropdown(matches.length > 0);
      setInTaxonomy(matches.some(m => m.toLowerCase() === q.trim().toLowerCase()));
    } catch {
      // network error — silently skip
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setInTaxonomy(null);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 300);
  }

  function select(match: string) {
    setQuery(match);
    onChange(match);
    setInTaxonomy(true);
    setResults([]);
    setShowDropdown(false);
  }

  return (
    <div className="relative">
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        onFocus={() => { if (query.length >= 2 && results.length > 0) setShowDropdown(true); }}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
      />
      {showDropdown && results.length > 0 && (
        <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={() => select(r)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-[#E8622A]/5 hover:text-[#E8622A] transition-colors"
              >
                {r}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.length > 2 && inTaxonomy === false && (
        <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Not in taxonomy — verify it exists in your GBP picker
        </p>
      )}
    </div>
  );
}

// ── File icon helper ──────────────────────────────────────────────────────────

function FileIcon({ path }: { path: string }) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return <Image className="w-4 h-4 text-blue-400" />;
  return <FileText className="w-4 h-4 text-gray-400" />;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GBPSetupTab({ client }: { client: Client }) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'starter' | 'guide'>('starter');

  // ── Section 1: Competitor research files ─────────────────────────────────
  type ResearchFile = { url: string; name: string; uploaded_at: string };
  const [files, setFiles] = useState<ResearchFile[]>(client.competitor_research_files ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setUploadError('File must be under 10MB'); return; }
    setUploading(true);
    setUploadError('');
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `competitor-research/${client.id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from('client-files').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('client-files').getPublicUrl(path);
      const entry: ResearchFile = { url: urlData.publicUrl, name: file.name, uploaded_at: new Date().toISOString() };
      const newFiles = [...files, entry];
      setFiles(newFiles);
      await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_research_files: newFiles }),
      });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeFile(url: string) {
    const newFiles = files.filter(f => f.url !== url);
    setFiles(newFiles);
    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_research_files: newFiles }),
    });
  }

  // ── Section 2: GBP Categories ─────────────────────────────────────────────
  // Defensive coerce: DB can return objects shaped {category, location, ...} instead of strings.
  // If that happens, extract the `category` key; fall back to JSON so we never store [object Object].
  function coerceCat(v: unknown): string {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return typeof o.category === 'string' ? o.category : JSON.stringify(v);
    }
    return '';
  }
  const [primary, setPrimary] = useState(coerceCat(client.gbp_primary_category));
  const initSec = client.gbp_secondary_categories ?? [];
  const [sec1, setSec1] = useState(coerceCat(initSec[0]));
  const [sec2, setSec2] = useState(coerceCat(initSec[1]));
  const [sec3, setSec3] = useState(coerceCat(initSec[2]));
  const [sec4, setSec4] = useState(coerceCat(initSec[3]));
  const [catDirty, setCatDirty] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [catSaved, setCatSaved] = useState(false);

  function markCatDirty() { setCatDirty(true); setCatSaved(false); }

  async function saveCategories() {
    setCatSaving(true);
    try {
      const secondaries = [sec1, sec2, sec3, sec4].map(s => s.trim()).filter(Boolean);
      // gbp_categories must be a dict (not a list) so the override flag survives agent runs.
      // content_agent writes to gbp_category_names instead, leaving this key alone.
      const existingGbpCats = (client.website_data as Record<string, unknown>)?.gbp_categories;
      const gbpCategoriesDict: Record<string, unknown> = {
        ...(typeof existingGbpCats === 'object' && !Array.isArray(existingGbpCats) && existingGbpCats !== null
          ? (existingGbpCats as Record<string, unknown>)
          : {}),
        manual_override: true,
      };
      const updatedWd = {
        ...(client.website_data ?? {}),
        gbp_manual_override: true,        // root-level flag (backward compat)
        gbp_categories: gbpCategoriesDict, // authoritative dict with override flag
      };
      await Promise.all([
        fetch(`/api/clients/${client.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gbp_primary_category: primary.trim(), website_data: updatedWd }),
        }),
        fetch(`/api/clients/${client.id}/categories`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories: secondaries }),
        }),
      ]);
      setCatDirty(false);
      setCatSaved(true);
    } catch {
      // save error — user will see the dirty state
    } finally {
      setCatSaving(false);
    }
  }

  // ── Section 3: Services ───────────────────────────────────────────────────
  const [services, setServices] = useState(client.manual_services ?? '');
  const [svcDirty, setSvcDirty] = useState(false);
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcSaved, setSvcSaved] = useState(false);

  async function saveServices() {
    setSvcSaving(true);
    try {
      const updatedWd = {
        ...(client.website_data ?? {}),
        manual_services: { manual_override: true },
      };
      await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual_services: services, website_data: updatedWd }),
      });
      setSvcDirty(false);
      setSvcSaved(true);
    } catch {
      //
    } finally {
      setSvcSaving(false);
    }
  }

  // ── Section 4: Agency Notes ───────────────────────────────────────────────
  const [notes, setNotes] = useState(client.agency_notes ?? '');
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  async function saveNotes() {
    setNotesSaving(true);
    try {
      const updatedWd = {
        ...(client.website_data ?? {}),
        agency_notes: { manual_override: true },
      };
      await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agency_notes: notes, website_data: updatedWd }),
      });
      setNotesDirty(false);
      setNotesSaved(true);
    } catch {
      //
    } finally {
      setNotesSaving(false);
    }
  }

  // ── Section 5: Target Suburbs ─────────────────────────────────────────────
  function coerceSuburb(v: unknown): string {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return typeof o.location === 'string' ? o.location
        : typeof o.name === 'string' ? o.name
        : typeof o.suburb === 'string' ? o.suburb
        : JSON.stringify(v);
    }
    return '';
  }
  const [suburbs, setSuburbs] = useState<string[]>(
    (client.target_suburbs ?? []).map(coerceSuburb).filter(Boolean)
  );
  const [suburbInput, setSuburbInput] = useState('');
  const [suburbDirty, setSuburbDirty] = useState(false);
  const [suburbSaving, setSuburbSaving] = useState(false);
  const [suburbSaved, setSuburbSaved] = useState(false);

  function addSuburb(raw: string) {
    const tags = raw.split(/[,\n]+/).map(s => s.trim()).filter(s => s && !suburbs.includes(s));
    if (!tags.length) { setSuburbInput(''); return; }
    const next = [...suburbs, ...tags];
    setSuburbs(next);
    setSuburbInput('');
    setSuburbDirty(true);
    setSuburbSaved(false);
  }

  function removeSuburb(tag: string) {
    setSuburbs(prev => prev.filter(s => s !== tag));
    setSuburbDirty(true);
    setSuburbSaved(false);
  }

  async function saveSuburbs() {
    setSuburbSaving(true);
    try {
      const updatedWd = {
        ...(client.website_data ?? {}),
        target_suburbs: { manual_override: true },
      };
      await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_suburbs: suburbs, website_data: updatedWd }),
      });
      setSuburbDirty(false);
      setSuburbSaved(true);
    } catch {
      //
    } finally {
      setSuburbSaving(false);
    }
  }

  // ── Section 6: Run Pipeline ───────────────────────────────────────────────
  // Use a snapshot of client enriched with local edits for validation
  const clientSnapshot: Client = {
    ...client,
    gbp_primary_category: primary.trim() || null,
    gbp_secondary_categories: [sec1, sec2, sec3, sec4].map(s => s.trim()).filter(Boolean),
    manual_services: services,
    agency_notes: notes,
    target_suburbs: suburbs,
  };
  const validation = getSetupValidation(clientSnapshot);

  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState('');
  const [pipelineError, setPipelineError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => () => clearInterval(pollRef.current), []);

  async function runPipeline() {
    if (!validation.allValid) return;
    setPipelineRunning(true);
    setPipelineError('');
    setPipelineStatus('Starting pipeline…');
    try {
      const res = await fetch(`${RAILWAY}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? err?.error ?? `HTTP ${res.status}`);
      }
      setPipelineStatus('Pipeline started — polling for updates…');
      pollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`${RAILWAY}/status/${client.id}`);
          if (!sr.ok) return;
          const sd = await sr.json();
          const stage: string = sd?.stage ?? sd?.status ?? '';
          const done = ['complete', 'done', 'finished', 'error', 'failed'].some(s => stage.toLowerCase().includes(s));
          if (stage) setPipelineStatus(stage);
          if (done) {
            clearInterval(pollRef.current);
            setPipelineRunning(false);
            if (stage.toLowerCase().includes('error') || stage.toLowerCase().includes('failed')) {
              setPipelineError(`Pipeline ended with status: ${stage}`);
            }
          }
        } catch {
          // polling error — keep going
        }
      }, 10_000);
    } catch (err: unknown) {
      setPipelineRunning(false);
      setPipelineError(err instanceof Error ? err.message : 'Pipeline start failed');
      setPipelineStatus('');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Subtab bar */}
      <div className="flex border-b border-gray-200 px-6 pt-4 gap-1">
        {(['starter', 'guide'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#E8622A] text-[#E8622A] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab === 'starter' ? 'Starter Info' : 'Setup Guide'}
          </button>
        ))}
      </div>

      {activeTab === 'guide' && <GBPSetupGuide client={client} />}

      {activeTab === 'starter' && <div className="p-6 space-y-4">

      {/* ── 1: Competitor Research Upload ─────────────────────────────────── */}
      <Section title="1. Competitor Research" badge={
        files.length > 0
          ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{files.length} file{files.length !== 1 ? 's' : ''}</span>
          : null
      }>
        <p className="text-xs text-gray-500">
          Upload screenshots, CSVs, or PDFs from competitor research. These are saved to Supabase Storage for reference.
        </p>

        {/* Existing files */}
        {files.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {files.map(f => {
              const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
              const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
              return (
                <div key={f.url} className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  {isImage ? (
                    <img src={f.url} alt={f.name} className="w-full h-24 object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-24 gap-1">
                      <FileIcon path={f.name} />
                      <span className="text-xs text-gray-500 px-2 text-center truncate w-full">{f.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(f.url)}
                    className="absolute top-1 right-1 bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                    className="absolute inset-0 opacity-0" aria-label={`Open ${f.name}`} />
                </div>
              );
            })}
          </div>
        )}

        {/* Upload button */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-[#E8622A] hover:text-[#E8622A] transition-colors disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading…' : 'Upload file (PNG, JPG, WebP, PDF, CSV · max 10MB)'}
          </button>
          {uploadError && (
            <p className="text-xs text-red-600 mt-1">{uploadError}</p>
          )}
        </div>
      </Section>

      {/* ── 2: GBP Categories ─────────────────────────────────────────────── */}
      <Section title="2. GBP Categories" badge={
        validation.hasPrimary && validation.hasSecondary
          ? <Check className="w-3.5 h-3.5 text-green-500" />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
      }>
        <div className="space-y-3">
          <CategoryInput
            label="Primary Category"
            placeholder="e.g. Car detailing service"
            value={primary}
            onChange={v => { setPrimary(v); markCatDirty(); }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CategoryInput label="Secondary 1" placeholder="Secondary category…" value={sec1} onChange={v => { setSec1(v); markCatDirty(); }} />
            <CategoryInput label="Secondary 2" placeholder="Secondary category…" value={sec2} onChange={v => { setSec2(v); markCatDirty(); }} />
            <CategoryInput label="Secondary 3" placeholder="Secondary category…" value={sec3} onChange={v => { setSec3(v); markCatDirty(); }} />
            <CategoryInput label="Secondary 4" placeholder="Secondary category…" value={sec4} onChange={v => { setSec4(v); markCatDirty(); }} />
          </div>
          <div className="flex justify-end">
            <SaveBtn dirty={catDirty} saving={catSaving} saved={catSaved} onSave={saveCategories} />
          </div>
        </div>
      </Section>

      {/* ── 3: Services ───────────────────────────────────────────────────── */}
      <Section title="3. Services" badge={
        validation.hasServices
          ? <Check className="w-3.5 h-3.5 text-green-500" />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
      }>
        <div>
          <p className="text-xs text-gray-500 mb-2">
            List the client&apos;s services — used by the pipeline to generate GBP service entries. Minimum 50 characters.
          </p>
          <textarea
            value={services}
            onChange={e => { setServices(e.target.value); setSvcDirty(true); setSvcSaved(false); }}
            rows={6}
            placeholder="e.g. Paint correction, ceramic coating, window tinting, interior detail, engine bay cleaning…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 resize-y"
          />
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs ${services.trim().length < 50 ? 'text-amber-600' : 'text-gray-400'}`}>
              {services.trim().length} chars {services.trim().length < 50 ? `(need ${50 - services.trim().length} more)` : ''}
            </span>
            <SaveBtn dirty={svcDirty} saving={svcSaving} saved={svcSaved} onSave={saveServices} />
          </div>
        </div>
      </Section>

      {/* ── 4: Agency Notes ───────────────────────────────────────────────── */}
      <Section title="4. Agency Notes" badge={
        validation.hasNotes
          ? <Check className="w-3.5 h-3.5 text-green-500" />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
      }>
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Internal notes: target keywords, suburb coverage, USPs, differentiators. Used as pipeline context. Minimum 100 characters.
          </p>
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setNotesDirty(true); setNotesSaved(false); }}
            rows={6}
            placeholder="e.g. Targets eastern suburbs of Adelaide. Differentiator is 24-hour mobile service. Focus on ceramic coating…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 resize-y"
          />
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs ${notes.trim().length < 100 ? 'text-amber-600' : 'text-gray-400'}`}>
              {notes.trim().length} chars {notes.trim().length < 100 ? `(need ${100 - notes.trim().length} more)` : ''}
            </span>
            <SaveBtn dirty={notesDirty} saving={notesSaving} saved={notesSaved} onSave={saveNotes} />
          </div>
        </div>
      </Section>

      {/* ── 5: Target Suburbs ─────────────────────────────────────────────── */}
      <Section title="5. Target Suburbs" badge={
        validation.hasSuburbs
          ? <Check className="w-3.5 h-3.5 text-green-500" />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
      }>
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Add suburbs the client wants to rank in. Press Enter or comma to add multiple.
          </p>

          {/* Tag list */}
          {suburbs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {suburbs.map(s => (
                <span key={s} className="flex items-center gap-1 text-xs bg-[#1a2744] text-white px-2.5 py-1 rounded-full">
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSuburb(s)}
                    className="hover:text-red-300 transition-colors ml-0.5"
                    aria-label={`Remove ${s}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={suburbInput}
              onChange={e => setSuburbInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addSuburb(suburbInput);
                }
              }}
              placeholder="Type suburb, press Enter or comma…"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
            />
            <button
              type="button"
              onClick={() => addSuburb(suburbInput)}
              disabled={!suburbInput.trim()}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>

          <div className="flex justify-end mt-2">
            <SaveBtn dirty={suburbDirty} saving={suburbSaving} saved={suburbSaved} onSave={saveSuburbs} />
          </div>
        </div>
      </Section>

      {/* ── 6: Run Pipeline ───────────────────────────────────────────────── */}
      <Section title="6. Run Pipeline" defaultOpen={true}>
        {/* Validation checklist */}
        <div className="space-y-1.5">
          {[
            { label: 'Primary GBP category set', ok: validation.hasPrimary },
            { label: 'At least one secondary category', ok: validation.hasSecondary },
            { label: 'Services entered (50+ chars)', ok: validation.hasServices },
            { label: 'Agency notes entered (100+ chars)', ok: validation.hasNotes },
            { label: 'Target suburbs added', ok: validation.hasSuburbs },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              {ok
                ? <Check className="w-4 h-4 text-green-500 shrink-0" />
                : <X className="w-4 h-4 text-red-400 shrink-0" />}
              <span className={ok ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
            </div>
          ))}
        </div>

        {!validation.allValid && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Complete all fields above before running the pipeline.
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={runPipeline}
            disabled={!validation.allValid || pipelineRunning}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1a2744] text-white text-sm font-medium rounded-lg hover:bg-[#243461] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pipelineRunning
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Play className="w-4 h-4" />}
            {pipelineRunning ? 'Running…' : 'Run Pipeline'}
          </button>
          {pipelineStatus && (
            <span className="text-sm text-gray-600">{pipelineStatus}</span>
          )}
        </div>

        {pipelineError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {pipelineError}
          </p>
        )}
      </Section>
    </div>}
    </div>
  );
}

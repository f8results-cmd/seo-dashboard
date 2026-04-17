'use client';

import { useState, useEffect } from 'react';
import type { Client } from '@/lib/types';

interface Props {
  client: Client;
}

export default function CategoriesTab({ client }: Props) {
  const [categories, setCategories] = useState<string[]>([]);
  const [primaryCategory, setPrimaryCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Regenerate state
  const [regenerating, setRegenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, boolean>>({});
  const [regenError, setRegenError] = useState('');

  // Add-new state
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetch(`/api/clients/${client.id}/categories`)
      .then(r => r.json())
      .then(data => {
        setCategories(data.categories ?? []);
        setPrimaryCategory(data.gbp_primary_category ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [client.id]);

  // ── Reorder ──────────────────────────────────────────────────────────────

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= categories.length) return;
    const updated = [...categories];
    [updated[index], updated[next]] = [updated[next], updated[index]];
    setCategories(updated);
    setDirty(true);
  }

  // ── Remove ───────────────────────────────────────────────────────────────

  function remove(index: number) {
    setCategories(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  // ── Add ──────────────────────────────────────────────────────────────────

  function addCategory() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      setNewName('');
      return;
    }
    setCategories(prev => [...prev, trimmed]);
    setNewName('');
    setDirty(true);
  }

  function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function save() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`/api/clients/${client.id}/categories`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? 'Save failed');
      }
      setDirty(false);
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Regenerate ───────────────────────────────────────────────────────────

  async function regenerate() {
    setRegenerating(true);
    setRegenError('');
    setSuggestions([]);
    setSelectedSuggestions({});
    try {
      const res = await fetch(`/api/clients/${client.id}/categories/regenerate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Regenerate failed');
      const suggested: string[] = data.categories ?? [];
      setSuggestions(suggested);
      // Pre-select all suggestions that aren't already in the list
      const init: Record<string, boolean> = {};
      for (const s of suggested) init[s] = !categories.includes(s);
      setSelectedSuggestions(init);
    } catch (err: unknown) {
      setRegenError(err instanceof Error ? err.message : 'Regenerate failed');
    } finally {
      setRegenerating(false);
    }
  }

  function toggleSuggestion(name: string) {
    setSelectedSuggestions(prev => ({ ...prev, [name]: !prev[name] }));
  }

  function applySuggestions() {
    const chosen = suggestions.filter(s => selectedSuggestions[s]);
    if (!chosen.length) return;
    // Replace the entire list with the chosen suggestions
    setCategories(chosen);
    setSuggestions([]);
    setSelectedSuggestions({});
    setDirty(true);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">GBP Secondary Categories</h2>
          {primaryCategory && (
            <p className="text-xs text-gray-400 mt-0.5">
              Primary: <span className="text-gray-600 font-medium">{primaryCategory}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-[#E8622A] text-white text-sm font-medium rounded-lg hover:bg-[#d05520] transition-colors disabled:opacity-60"
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

      {/* Category list */}
      {categories.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No categories yet. Add one below or use Regenerate.</p>
      ) : (
        <ul className="space-y-2">
          {categories.map((cat, i) => (
            <li
              key={`${cat}-${i}`}
              className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5"
            >
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  aria-label="Move up"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === categories.length - 1}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  aria-label="Move down"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Index badge */}
              <span className="text-xs text-gray-400 w-5 text-center flex-shrink-0">{i + 1}</span>

              {/* Name */}
              <span className="flex-1 text-sm text-gray-800">{cat}</span>

              {/* Remove */}
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                aria-label="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="Add category name…"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
        />
        <button
          type="button"
          onClick={addCategory}
          disabled={!newName.trim()}
          className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {/* Regenerate section */}
      <div className="border-t border-gray-100 pt-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Regenerate suggestions</p>
            <p className="text-xs text-gray-400">Ask Claude to suggest 4–5 categories for this niche + location</p>
          </div>
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-gray-400 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {regenerating && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {regenerating ? 'Generating…' : 'Regenerate'}
          </button>
        </div>

        {regenError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {regenError}
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
              Review suggestions — select which to use
            </p>
            <ul className="space-y-1.5">
              {suggestions.map(s => (
                <li key={s} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`sug-${s}`}
                    checked={!!selectedSuggestions[s]}
                    onChange={() => toggleSuggestion(s)}
                    className="accent-[#E8622A]"
                  />
                  <label htmlFor={`sug-${s}`} className="text-sm text-gray-800 cursor-pointer select-none">
                    {s}
                    {categories.includes(s) && (
                      <span className="ml-2 text-xs text-gray-400">(already in list)</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={applySuggestions}
                disabled={!suggestions.some(s => selectedSuggestions[s])}
                className="px-4 py-1.5 bg-[#1a2744] text-white text-sm font-medium rounded-lg hover:bg-[#243565] transition-colors disabled:opacity-40"
              >
                Use selected
              </button>
              <button
                type="button"
                onClick={() => { setSuggestions([]); setSelectedSuggestions({}); }}
                className="px-4 py-1.5 text-gray-500 text-sm hover:text-gray-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline note */}
      <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
        Saving updates <code className="bg-gray-100 px-1 rounded">gbp_secondary_categories</code> and syncs names
        in <code className="bg-gray-100 px-1 rounded">website_data</code>. Run a full ContentAgent pipeline to
        regenerate page body content for new categories.
      </p>
    </div>
  );
}

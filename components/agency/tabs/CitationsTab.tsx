'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ExternalLink, CheckCircle, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CitationOpportunity {
  id: string;
  client_id: string;
  directory_name: string;
  directory_url: string | null;
  domain_authority: number | null;
  niche_relevance: string | null;
  status: 'identified' | 'submitted' | 'live';
  notes: string | null;
  created_at: string;
  submitted_at: string | null;
  live_at: string | null;
}

interface BacklinkOpportunity {
  name: string;
  url: string;
  relevance: string;
  how_to_get: string;
  paid: boolean;
  effort: 'Low' | 'Medium' | 'High';
  authority: 'Low' | 'Medium' | 'High';
  priority: 'High' | 'Medium' | 'Low';
  done?: boolean;
  hidden?: boolean;
}

interface AISuggestion {
  name: string;
  url: string;
  domain_authority: number | null;
  niche_relevance: string;
}

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified',
  submitted:  'Submitted',
  live:       'Live',
};
const STATUS_STYLES: Record<string, string> = {
  identified: 'bg-gray-100 text-gray-600',
  submitted:  'bg-amber-100 text-amber-700',
  live:       'bg-green-100 text-green-700',
};

// ── Add opportunity modal ─────────────────────────────────────────────────────

function AddModal({
  clientId,
  prefill,
  onClose,
  onSaved,
}: {
  clientId: string;
  prefill?: AISuggestion;
  onClose: () => void;
  onSaved: (opp: CitationOpportunity) => void;
}) {
  const supabase = createClient();
  const [name,  setName]  = useState(prefill?.name ?? '');
  const [url,   setUrl]   = useState(prefill?.url ?? '');
  const [da,    setDa]    = useState<string>(prefill?.domain_authority != null ? String(prefill.domain_authority) : '');
  const [rel,   setRel]   = useState(prefill?.niche_relevance ?? '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err,   setErr]   = useState('');

  async function save() {
    if (!name.trim()) { setErr('Directory name is required.'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('citation_opportunities').insert({
      client_id: clientId,
      directory_name: name.trim(),
      directory_url:  url.trim() || null,
      domain_authority: da ? Number(da) : null,
      niche_relevance: rel.trim() || null,
      notes: notes.trim() || null,
      status: 'identified',
    }).select().single();
    if (error) { setErr(error.message); setSaving(false); return; }
    onSaved(data as CitationOpportunity);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-900">{prefill ? 'Add Suggested Directory' : 'Add Custom Opportunity'}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Directory name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              placeholder="e.g. True Local"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">URL</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              placeholder="https://…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Domain authority</label>
              <input
                type="number"
                value={da}
                onChange={e => setDa(e.target.value)}
                min={0} max={100}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                placeholder="0–100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Niche relevance</label>
              <input
                value={rel}
                onChange={e => setRel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
                placeholder="High / Medium / Low"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 resize-none"
              placeholder="Login details, submission notes…"
            />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-[#E8622A] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#d05520] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add opportunity'}
            </button>
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Opportunity row ───────────────────────────────────────────────────────────

function OpportunityRow({
  opp,
  onStatusChange,
  onDelete,
}: {
  opp: CitationOpportunity;
  onStatusChange: (id: string, status: CitationOpportunity['status']) => void;
  onDelete: (id: string) => void;
}) {
  const supabase = createClient();
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(opp.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  async function cycleStatus() {
    const next: CitationOpportunity['status'] =
      opp.status === 'identified' ? 'submitted'
      : opp.status === 'submitted' ? 'live'
      : 'identified';
    const patch: Partial<CitationOpportunity> = { status: next };
    if (next === 'submitted') patch.submitted_at = new Date().toISOString();
    if (next === 'live') patch.live_at = new Date().toISOString();
    await supabase.from('citation_opportunities').update(patch).eq('id', opp.id);
    onStatusChange(opp.id, next);
  }

  async function saveNotes() {
    if (notes === (opp.notes ?? '')) return;
    setSavingNotes(true);
    await supabase.from('citation_opportunities').update({ notes }).eq('id', opp.id);
    setSavingNotes(false);
  }

  async function deleteOpp() {
    await supabase.from('citation_opportunities').delete().eq('id', opp.id);
    onDelete(opp.id);
  }

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden ${opp.status === 'live' ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{opp.directory_name}</span>
            {opp.domain_authority != null && (
              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">DA {opp.domain_authority}</span>
            )}
            {opp.niche_relevance && (
              <span className="text-xs text-gray-500">{opp.niche_relevance}</span>
            )}
          </div>
          {opp.directory_url && (
            <a href={opp.directory_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5">
              <ExternalLink className="w-3 h-3" />{opp.directory_url.replace(/^https?:\/\//, '').split('/')[0]}
            </a>
          )}
        </div>

        <button
          onClick={cycleStatus}
          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${STATUS_STYLES[opp.status]} hover:opacity-80`}
          title="Click to advance status"
        >
          {STATUS_LABELS[opp.status]}
        </button>

        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-2">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={2}
            placeholder="Notes, login details, submission status…"
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 resize-none"
          />
          {savingNotes && <p className="text-xs text-gray-400">Saving…</p>}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {opp.submitted_at && <span>Submitted: {new Date(opp.submitted_at).toLocaleDateString('en-AU')}</span>}
            {opp.live_at && <span>Live: {new Date(opp.live_at).toLocaleDateString('en-AU')}</span>}
            <button onClick={deleteOpp} className="ml-auto text-red-400 hover:text-red-600 transition-colors">Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CitationsTab({ client }: { client: Client }) {
  const supabase = createClient();
  const wd = (client.website_data ?? {}) as Record<string, unknown>;
  const leadSnapId = wd.leadsnap_location_id as number | undefined;
  const citationSummary = wd.citation_summary as Record<string, number> | undefined;

  const [opps,         setOpps]         = useState<CitationOpportunity[]>([]);
  const [loadingOpps,  setLoadingOpps]  = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | CitationOpportunity['status']>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [prefill,      setPrefill]      = useState<AISuggestion | undefined>();

  const [suggestions,    setSuggestions]    = useState<AISuggestion[]>([]);
  const [researching,    setResearching]    = useState(false);
  const [researchErr,    setResearchErr]    = useState('');

  // Existing backlink report from website_data (legacy)
  const backlinkReport = wd.backlink_opportunities as { categories?: Record<string, BacklinkOpportunity[]>; total_opportunities?: number } | undefined;
  const legacyOpps = backlinkReport
    ? Object.values(backlinkReport.categories ?? {}).flat().filter((o: BacklinkOpportunity) => !o.hidden)
    : [];

  const loadOpps = useCallback(async () => {
    const { data } = await supabase
      .from('citation_opportunities')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    setOpps((data ?? []) as CitationOpportunity[]);
    setLoadingOpps(false);
  }, [client.id]);

  useEffect(() => { loadOpps(); }, [loadOpps]);

  function updateStatus(id: string, status: CitationOpportunity['status']) {
    setOpps(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  }

  function deleteOpp(id: string) {
    setOpps(prev => prev.filter(o => o.id !== id));
  }

  function handleSaved(opp: CitationOpportunity) {
    setOpps(prev => [opp, ...prev]);
    setSuggestions(prev => prev.filter(s => s.name !== opp.directory_name));
  }

  async function findOpportunities() {
    if (!RAILWAY_URL) { setResearchErr('RAILWAY_URL not configured.'); return; }
    setResearching(true);
    setResearchErr('');
    setSuggestions([]);
    try {
      const res = await fetch(`${RAILWAY_URL}/citation-research/${client.id}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      if ((data.suggestions ?? []).length === 0) setResearchErr('No new suggestions found — all may already be tracked.');
    } catch (e: unknown) {
      setResearchErr(e instanceof Error ? e.message : 'Research failed. Try again.');
    }
    setResearching(false);
  }

  const filteredOpps = opps.filter(o => statusFilter === 'all' || o.status === statusFilter);
  const counts = { all: opps.length, identified: opps.filter(o => o.status === 'identified').length, submitted: opps.filter(o => o.status === 'submitted').length, live: opps.filter(o => o.status === 'live').length };

  return (
    <div className="p-6 space-y-6">

      {/* ── Section 1: LeadSnap ─────────────────────────────────────────────── */}
      <div className="bg-[#1a2744] text-white rounded-xl px-5 py-4">
        <p className="text-sm font-semibold mb-1">Section 1 — LeadSnap Citation Status</p>
        {leadSnapId ? (
          <div className="grid grid-cols-3 gap-4 mt-2 text-center">
            <div><p className="text-xl font-bold">{citationSummary?.total_submitted ?? 0}</p><p className="text-xs text-slate-400">Submitted</p></div>
            <div><p className="text-xl font-bold">{citationSummary?.total_synced ?? 0}</p><p className="text-xs text-slate-400">Synced</p></div>
            <div><p className="text-xl font-bold">{citationSummary?.total_pending ?? 0}</p><p className="text-xs text-slate-400">Pending</p></div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 mt-1">No LeadSnap data yet — run the citation agent.</p>
        )}
      </div>

      {/* ── Section 2: Manual opportunities ─────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="font-semibold text-gray-900 text-sm">Section 2 — Citation Opportunities</h3>
          <div className="flex items-center gap-1 flex-1">
            {(['all', 'identified', 'submitted', 'live'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s ? 'bg-[#1a2744] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]} ({counts[s]})
              </button>
            ))}
          </div>
          <button
            onClick={() => { setPrefill(undefined); setShowAddModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E8622A] text-white text-xs font-medium rounded-lg hover:bg-[#d05520] transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add custom
          </button>
        </div>

        {loadingOpps ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filteredOpps.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            {opps.length === 0
              ? 'No opportunities tracked yet. Add one above or use "Find more" below.'
              : `No ${statusFilter} opportunities.`}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredOpps.map(opp => (
              <OpportunityRow key={opp.id} opp={opp} onStatusChange={updateStatus} onDelete={deleteOpp} />
            ))}
          </div>
        )}

        {/* Legacy backlink report opps — shown if citation_opportunities table is empty */}
        {opps.length === 0 && legacyOpps.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 mb-2">Legacy backlink research ({legacyOpps.length} opportunities from pipeline):</p>
            <div className="space-y-2">
              {legacyOpps.slice(0, 10).map((opp: BacklinkOpportunity, i: number) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border border-gray-200 rounded-lg">
                  <span className="text-sm text-gray-800 flex-1">{opp.name}</span>
                  {opp.url && (
                    <a href={opp.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                      <ExternalLink className="w-3 h-3" /> Visit
                    </a>
                  )}
                  {opp.done && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                  <button
                    onClick={() => { setPrefill({ name: opp.name, url: opp.url, domain_authority: null, niche_relevance: opp.relevance }); setShowAddModal(true); }}
                    className="text-xs text-[#E8622A] hover:underline shrink-0"
                  >
                    Track it
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Find more ─────────────────────────────────────────────── */}
      <div className="border border-dashed border-gray-200 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Section 3 — Find More Opportunities</h3>
            <p className="text-xs text-gray-500">
              Research AU directories relevant to <strong>{client.niche}</strong> in <strong>{client.city}</strong>.
              Returns 5–10 suggestions with DA and relevance scores.
            </p>
          </div>
          <button
            onClick={findOpportunities}
            disabled={researching}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a2744] text-white text-sm font-medium rounded-lg hover:bg-[#243461] transition-colors disabled:opacity-50 shrink-0"
          >
            {researching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {researching ? 'Researching…' : 'Find opportunities'}
          </button>
        </div>

        {researchErr && <p className="text-sm text-red-600 mt-3">{researchErr}</p>}

        {suggestions.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-500 font-medium">{suggestions.length} suggestions found — click Add to track:</p>
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 bg-blue-50/50 border border-blue-100 rounded-lg px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    {s.domain_authority != null && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">DA {s.domain_authority}</span>
                    )}
                    {s.niche_relevance && <span className="text-xs text-gray-500">{s.niche_relevance}</span>}
                  </div>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">{s.url.replace(/^https?:\/\//, '').split('/')[0]}</a>
                  )}
                </div>
                <button
                  onClick={() => { setPrefill(s); setShowAddModal(true); }}
                  className="flex items-center gap-1 text-xs bg-[#E8622A] text-white px-2.5 py-1 rounded-lg hover:bg-[#d05520] transition-colors shrink-0"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAddModal && (
        <AddModal
          clientId={client.id}
          prefill={prefill}
          onClose={() => { setShowAddModal(false); setPrefill(undefined); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

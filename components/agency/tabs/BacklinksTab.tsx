'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, ExternalLink, X, Building2, Newspaper,
  Globe, Trophy, Users, Link2, Search, ChevronDown, Plus,
} from 'lucide-react';
import type { Client } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type OpportunityStatus =
  | 'new' | 'outreach_sent' | 'awaiting_response'
  | 'responded' | 'link_acquired' | 'rejected' | 'not_viable';

type OpportunityType =
  | 'chamber' | 'association' | 'news' | 'directory'
  | 'blog' | 'sponsorship' | 'guest_post' | 'supplier' | 'award' | 'other';

type ManualOpportunityType = 'backlink' | 'citation' | 'directory' | 'sponsorship' | 'partnership';

interface BacklinkOpportunity {
  id: string;
  client_id: string;
  name: string;
  url: string;
  type: OpportunityType;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'quick' | 'medium' | 'high';
  acquisition_method: string;
  estimated_cost: string;
  status: OpportunityStatus;
  outreach_sent_at: string | null;
  last_contact_date: string | null;
  notes: string | null;
  created_at: string;
  // fields added by manual entry
  opportunity_type?: ManualOpportunityType;
  type_label?: string;
  action_description?: string;
}

interface Props {
  client: Client;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: OpportunityStatus; label: string }[] = [
  { value: 'new',               label: 'New' },
  { value: 'outreach_sent',     label: 'Outreach Sent' },
  { value: 'awaiting_response', label: 'Awaiting Response' },
  { value: 'responded',         label: 'Responded' },
  { value: 'link_acquired',     label: 'Link Acquired' },
  { value: 'rejected',          label: 'Rejected' },
  { value: 'not_viable',        label: 'Not Viable' },
];

const FILTER_PILLS: { value: 'all' | OpportunityStatus; label: string }[] = [
  { value: 'all',               label: 'All' },
  { value: 'new',               label: 'New' },
  { value: 'outreach_sent',     label: 'Outreach Sent' },
  { value: 'awaiting_response', label: 'Awaiting Response' },
  { value: 'responded',         label: 'Responded' },
  { value: 'link_acquired',     label: 'Acquired' },
  { value: 'rejected',          label: 'Rejected' },
  { value: 'not_viable',        label: 'Not Viable' },
];

const TYPE_FILTER_PILLS: { value: 'all' | ManualOpportunityType; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'backlink',    label: 'Backlinks' },
  { value: 'citation',    label: 'Citations' },
  { value: 'directory',   label: 'Directories' },
  { value: 'sponsorship', label: 'Sponsorships' },
  { value: 'partnership', label: 'Partnerships' },
];

const MANUAL_TYPE_OPTIONS: { value: ManualOpportunityType; label: string }[] = [
  { value: 'backlink',    label: 'Backlink' },
  { value: 'citation',    label: 'Citation' },
  { value: 'directory',   label: 'Directory' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'partnership', label: 'Partnership' },
];

const TYPE_ICONS: Record<OpportunityType, React.ReactNode> = {
  chamber:    <Building2 className="w-3.5 h-3.5" />,
  association:<Users className="w-3.5 h-3.5" />,
  news:       <Newspaper className="w-3.5 h-3.5" />,
  directory:  <Globe className="w-3.5 h-3.5" />,
  blog:       <Globe className="w-3.5 h-3.5" />,
  sponsorship:<Trophy className="w-3.5 h-3.5" />,
  guest_post: <Link2 className="w-3.5 h-3.5" />,
  supplier:   <Link2 className="w-3.5 h-3.5" />,
  award:      <Trophy className="w-3.5 h-3.5" />,
  other:      <Globe className="w-3.5 h-3.5" />,
};

const TYPE_LABELS: Record<OpportunityType, string> = {
  chamber:    'Chamber',
  association:'Association',
  news:       'News',
  directory:  'Directory',
  blog:       'Blog',
  sponsorship:'Sponsorship',
  guest_post: 'Guest Post',
  supplier:   'Supplier',
  award:      'Award',
  other:      'Other',
};

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityBadge(p: 'high' | 'medium' | 'low') {
  const cls =
    p === 'high'   ? 'bg-green-100 text-green-800' :
    p === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                     'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {p.charAt(0).toUpperCase() + p.slice(1)}
    </span>
  );
}

function effortBadge(e: 'quick' | 'medium' | 'high') {
  const cls =
    e === 'quick'  ? 'bg-blue-50 text-blue-700' :
    e === 'medium' ? 'bg-purple-50 text-purple-700' :
                     'bg-orange-50 text-orange-700';
  const label = e === 'quick' ? '< 15 min' : e === 'medium' ? '15–60 min' : '60+ min';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function statusBadge(s: OpportunityStatus) {
  const map: Record<OpportunityStatus, string> = {
    new:               'bg-slate-100 text-slate-700',
    outreach_sent:     'bg-blue-100 text-blue-800',
    awaiting_response: 'bg-yellow-100 text-yellow-800',
    responded:         'bg-purple-100 text-purple-800',
    link_acquired:     'bg-green-100 text-green-800',
    rejected:          'bg-red-100 text-red-800',
    not_viable:        'bg-gray-100 text-gray-500',
  };
  const label = STATUS_OPTIONS.find(o => o.value === s)?.label ?? s;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[s] ?? ''}`}>
      {label}
    </span>
  );
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

interface ParsedCsvRow {
  opportunity_name: string;
  opportunity_url: string;
  opportunity_type: string;
  type_label: string;
  priority: string;
  effort: string;
  cost: string;
  action_description: string;
}

function parseCsv(raw: string): ParsedCsvRow[] {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    const cols = parseCsvRow(line);
    return {
      opportunity_name: cols[0] ?? '',
      opportunity_url:  cols[1] ?? '',
      opportunity_type: cols[2] ?? '',
      type_label:       cols[3] ?? '',
      priority:         cols[4] ?? '',
      effort:           cols[5] ?? '',
      cost:             cols[6] ?? '',
      action_description: cols[7] ?? '',
    };
  }).filter(r => r.opportunity_name);
}

// ── Add Manual Modal ──────────────────────────────────────────────────────────

const BLANK_FORM = {
  opportunity_name: '',
  opportunity_url: '',
  opportunity_type: 'citation' as ManualOpportunityType,
  type_label: '',
  priority: 'medium' as 'high' | 'medium' | 'low',
  effort: '< 15 min',
  cost: '$0',
  action_description: '',
  notes: '',
};

function AddManualModal({
  clientId,
  onClose,
  onSuccess,
}: {
  clientId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Bulk state
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    setParsedRows(parseCsv(csvText));
  }, [csvText]);

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/30 bg-white';

  async function handleSingleSave() {
    if (!form.opportunity_name.trim()) { setSaveError('Opportunity Name is required.'); return; }
    setSaveError('');
    setSaving(true);
    try {
      const res = await fetch(`${RAILWAY_URL}/local-opportunities/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_name:    form.opportunity_name.trim(),
          opportunity_url:     form.opportunity_url.trim(),
          opportunity_type:    form.opportunity_type,
          type_label:          form.type_label.trim(),
          priority:            form.priority,
          effort:              form.effort,
          cost:                form.cost,
          action_description:  form.action_description.trim(),
          notes:               form.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onSuccess();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Try again.');
    }
    setSaving(false);
  }

  async function handleBulkImport() {
    if (parsedRows.length === 0) return;
    setImportError('');
    setImporting(true);
    try {
      const res = await fetch(`${RAILWAY_URL}/local-opportunities/${clientId}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onSuccess();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed. Try again.');
    }
    setImporting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add Manual Opportunity</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-100 px-5">
          {(['single', 'bulk'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2.5 px-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-[#E8622A] text-[#E8622A]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'single' ? 'Single Entry' : 'Bulk CSV Import'}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5">
          {tab === 'single' ? (
            <div className="space-y-3.5">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Opportunity Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Geelong Chamber of Commerce"
                  value={form.opportunity_name}
                  onChange={e => setForm(f => ({ ...f, opportunity_name: e.target.value }))}
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">URL</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="https://..."
                  value={form.opportunity_url}
                  onChange={e => setForm(f => ({ ...f, opportunity_url: e.target.value }))}
                />
              </div>

              {/* Type + Type label */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Type</label>
                  <select
                    className={inputCls}
                    value={form.opportunity_type}
                    onChange={e => setForm(f => ({ ...f, opportunity_type: e.target.value as ManualOpportunityType }))}
                  >
                    {MANUAL_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Type Label</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="e.g. Local Chamber"
                    value={form.type_label}
                    onChange={e => setForm(f => ({ ...f, type_label: e.target.value }))}
                  />
                </div>
              </div>

              {/* Priority + Effort + Cost */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Priority</label>
                  <select
                    className={inputCls}
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Effort</label>
                  <select
                    className={inputCls}
                    value={form.effort}
                    onChange={e => setForm(f => ({ ...f, effort: e.target.value }))}
                  >
                    <option value="< 15 min">&lt; 15 min</option>
                    <option value="15-60 min">15–60 min</option>
                    <option value="60+ min">60+ min</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Cost</label>
                  <select
                    className={inputCls}
                    value={form.cost}
                    onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  >
                    <option value="$0">$0</option>
                    <option value="$0-100">$0–100</option>
                    <option value="$100-500">$100–500</option>
                    <option value="$500+">$500+</option>
                  </select>
                </div>
              </div>

              {/* Action description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Action Description</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={2}
                  placeholder="What needs to be done to acquire this opportunity?"
                  value={form.action_description}
                  onChange={e => setForm(f => ({ ...f, action_description: e.target.value }))}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes (optional)</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={2}
                  placeholder="Contact details, context, follow-up reminders…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Paste CSV rows
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Expected columns (no header row): <span className="font-mono">name, url, type, type_label, priority, effort, cost, action</span>
                </p>
                <textarea
                  className={`${inputCls} resize-none font-mono text-xs`}
                  rows={7}
                  placeholder={'Geelong Chamber,https://chamber.com.au,citation,Chamber,high,< 15 min,$0,Submit membership listing'}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                />
              </div>

              {parsedRows.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    Preview — {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} parsed
                    {parsedRows.length > 10 ? ' (showing first 10)' : ''}
                  </p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-2.5 py-1.5 text-left font-semibold text-gray-500">Name</th>
                          <th className="px-2.5 py-1.5 text-left font-semibold text-gray-500">Type</th>
                          <th className="px-2.5 py-1.5 text-left font-semibold text-gray-500">Priority</th>
                          <th className="px-2.5 py-1.5 text-left font-semibold text-gray-500">URL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedRows.slice(0, 10).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-2.5 py-1.5 text-gray-800 max-w-[120px] truncate">{row.opportunity_name || '—'}</td>
                            <td className="px-2.5 py-1.5 text-gray-600">{row.opportunity_type || '—'}</td>
                            <td className="px-2.5 py-1.5 text-gray-600">{row.priority || '—'}</td>
                            <td className="px-2.5 py-1.5 text-gray-400 max-w-[120px] truncate font-mono">{row.opportunity_url || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{importError}</p>
              )}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          {tab === 'single' ? (
            <button
              onClick={handleSingleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#E8622A] rounded-lg hover:bg-[#d45720] disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Opportunity'}
            </button>
          ) : (
            <button
              onClick={handleBulkImport}
              disabled={importing || parsedRows.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-[#E8622A] rounded-lg hover:bg-[#d45720] disabled:opacity-60 transition-colors"
            >
              {importing ? 'Importing…' : `Import ${parsedRows.length} row${parsedRows.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Drawer component ──────────────────────────────────────────────────────────

function OpportunityDrawer({
  opp,
  onClose,
  onSave,
  onDelete,
}: {
  opp: BacklinkOpportunity;
  onClose: () => void;
  onSave: (id: string, updates: Partial<BacklinkOpportunity>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [status, setStatus]           = useState<OpportunityStatus>(opp.status);
  const [notes, setNotes]             = useState(opp.notes ?? '');
  const [outreachDate, setOutreachDate] = useState(
    opp.outreach_sent_at ? opp.outreach_sent_at.slice(0, 10) : ''
  );
  const [lastContact, setLastContact] = useState(
    opp.last_contact_date ? opp.last_contact_date.slice(0, 10) : ''
  );
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(opp.id, {
      status,
      notes: notes || null,
      outreach_sent_at:  outreachDate  ? new Date(outreachDate).toISOString()  : null,
      last_contact_date: lastContact   ? new Date(lastContact).toISOString()   : null,
    });
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!confirm(`Remove "${opp.name}" from the list?`)) return;
    setDeleting(true);
    await onDelete(opp.id);
    setDeleting(false);
    onClose();
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/30 bg-white';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <a
              href={opp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-[#1B2B6B] hover:underline flex items-start gap-1.5 leading-snug"
            >
              {opp.name}
              <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            </a>
            <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">{opp.url}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1">
          {/* Read-only metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Type</p>
              <div className="flex items-center gap-1.5 text-sm text-gray-700">
                {TYPE_ICONS[opp.type]}
                {TYPE_LABELS[opp.type]}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Priority</p>
              {priorityBadge(opp.priority)}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Effort</p>
              {effortBadge(opp.effort)}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Est. Cost</p>
              <span className="text-sm font-medium text-gray-800">{opp.estimated_cost}</span>
            </div>
          </div>

          {opp.description && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed">{opp.description}</p>
            </div>
          )}

          {opp.acquisition_method && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                How to get this link
              </p>
              <p className="text-sm text-blue-800">{opp.acquisition_method}</p>
            </div>
          )}

          <hr className="border-gray-100" />

          {/* Editable fields */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
            <select
              className={inputCls}
              value={status}
              onChange={e => setStatus(e.target.value as OpportunityStatus)}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Outreach Sent Date
            </label>
            <input
              type="date"
              className={inputCls}
              value={outreachDate}
              onChange={e => setOutreachDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Last Contact Date
            </label>
            <input
              type="date"
              className={inputCls}
              value={lastContact}
              onChange={e => setLastContact(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contact details, follow-up reminders, outcome notes…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {deleting ? 'Removing…' : 'Remove'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1B2B6B] rounded-lg hover:bg-[#152259] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

type SortKey = 'priority' | 'effort' | 'date';
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const EFFORT_RANK:   Record<string, number> = { quick: 0, medium: 1, high: 2 };

export default function BacklinksTab({ client }: Props) {
  const [opportunities, setOpportunities] = useState<BacklinkOpportunity[]>([]);
  const [loading, setLoading]             = useState(true);
  const [researching, setResearching]     = useState(false);
  const [typeFilter, setTypeFilter]       = useState<'all' | ManualOpportunityType>('all');
  const [filter, setFilter]               = useState<'all' | OpportunityStatus>('all');
  const [sort, setSort]                   = useState<SortKey>('priority');
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [drawerOpp, setDrawerOpp]         = useState<BacklinkOpportunity | null>(null);
  const [bulkStatus, setBulkStatus]       = useState<OpportunityStatus>('outreach_sent');
  const [bulkApplying, setBulkApplying]   = useState(false);
  const [showAddModal, setShowAddModal]   = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? '';

  // ── Data loading ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/backlinks`);
      const json = await res.json();
      setOpportunities(json.opportunities ?? []);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  // ── Research trigger + polling ────────────────────────────────────────────────

  async function triggerResearch() {
    setResearching(true);
    try {
      const res = await fetch(`${apiBase}/backlinks/${client.id}/research`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Poll until new rows appear (up to ~6 minutes, every 10s)
      let attempts = 0;
      const before = opportunities.length;
      while (attempts < 36) {
        await new Promise(r => setTimeout(r, 10000));
        const pollRes = await fetch(`/api/clients/${client.id}/backlinks`);
        const pollJson = await pollRes.json();
        const newOpps: BacklinkOpportunity[] = pollJson.opportunities ?? [];
        if (newOpps.length > before) {
          setOpportunities(newOpps);
          break;
        }
        attempts++;
      }
      // Final reload regardless
      await load();
    } catch {
      /* noop */
    }
    setResearching(false);
  }

  // ── PATCH / DELETE helpers ────────────────────────────────────────────────────

  async function updateOpportunity(id: string, updates: Partial<BacklinkOpportunity>) {
    const res = await fetch(`/api/backlinks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setOpportunities(prev =>
        prev.map(o => o.id === id ? { ...o, ...updates } : o)
      );
    }
  }

  async function deleteOpportunity(id: string) {
    const res = await fetch(`/api/backlinks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setOpportunities(prev => prev.filter(o => o.id !== id));
    }
  }

  // Inline status change (dropdown in row)
  async function handleInlineStatus(id: string, newStatus: OpportunityStatus) {
    await updateOpportunity(id, { status: newStatus });
  }

  // Bulk action
  async function handleBulkStatus() {
    if (selectedIds.size === 0) return;
    setBulkApplying(true);
    await Promise.all(
      Array.from(selectedIds).map(id => updateOpportunity(id, { status: bulkStatus }))
    );
    setSelectedIds(new Set());
    setBulkApplying(false);
  }

  // ── Derived data ──────────────────────────────────────────────────────────────

  const typeFiltered = opportunities.filter(o => {
    if (typeFilter === 'all') return true;
    return o.opportunity_type === typeFilter;
  });

  const filtered = typeFiltered.filter(o => filter === 'all' || o.status === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'priority') {
      const pd = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
      return pd !== 0 ? pd : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sort === 'effort') {
      return (EFFORT_RANK[a.effort] ?? 1) - (EFFORT_RANK[b.effort] ?? 1);
    }
    // date
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const stats = {
    total:    opportunities.length,
    new:      opportunities.filter(o => o.status === 'new').length,
    sent:     opportunities.filter(o => o.status === 'outreach_sent' || o.status === 'awaiting_response').length,
    acquired: opportunities.filter(o => o.status === 'link_acquired').length,
    rejected: opportunities.filter(o => o.status === 'rejected').length,
  };

  // Select-all for current filtered view
  const allSelected = sorted.length > 0 && sorted.every(o => selectedIds.has(o.id));
  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map(o => o.id)));
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Local Backlink Opportunities</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manually track outreach. Nothing is sent automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E8622A] border border-[#E8622A]/40 rounded-lg hover:bg-[#E8622A]/5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Manual
          </button>
          <button
            onClick={triggerResearch}
            disabled={researching}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B2B6B] text-white text-sm font-medium rounded-lg hover:bg-[#152259] disabled:opacity-60 transition-colors"
          >
            {researching ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Researching…
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                {opportunities.length > 0 ? 'Re-research' : 'Research Opportunities'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* No data yet */}
      {opportunities.length === 0 && !researching && (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Link2 className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">No backlink opportunities yet</p>
          <p className="text-xs text-gray-500 mb-5">
            Run research to discover local directories, chambers, news sites, sponsors and more for{' '}
            {client.business_name}.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-[#E8622A] border border-[#E8622A]/40 text-sm font-medium rounded-lg hover:bg-[#E8622A]/5"
            >
              <Plus className="w-4 h-4" />
              Add Manually
            </button>
            <button
              onClick={triggerResearch}
              disabled={researching}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B2B6B] text-white text-sm font-medium rounded-lg hover:bg-[#1B2B6B]/90 disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              Research Opportunities
            </button>
          </div>
        </div>
      )}

      {/* Loading state while researching */}
      {researching && opportunities.length === 0 && (
        <div className="text-center py-12 bg-blue-50 rounded-xl border border-blue-100">
          <span className="w-8 h-8 border-2 border-blue-300 border-t-[#1B2B6B] rounded-full animate-spin inline-block mb-3" />
          <p className="text-sm font-medium text-blue-900">
            Running {client.city ? `${client.city} ` : ''}backlink research…
          </p>
          <p className="text-xs text-blue-700 mt-1">
            This takes 3–6 minutes — running ~20 searches across 10 categories
          </p>
        </div>
      )}

      {opportunities.length > 0 && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Total',    value: stats.total,    color: 'text-gray-900' },
              { label: 'New',      value: stats.new,      color: 'text-slate-700' },
              { label: 'In Progress', value: stats.sent,  color: 'text-blue-700' },
              { label: 'Acquired', value: stats.acquired, color: 'text-green-700' },
              { label: 'Rejected', value: stats.rejected, color: 'text-red-600'  },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Type filter pills (row 1) */}
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTER_PILLS.map(pill => (
              <button
                key={pill.value}
                onClick={() => setTypeFilter(pill.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  typeFilter === pill.value
                    ? 'bg-[#E8622A] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {pill.label}
                {pill.value !== 'all' && (
                  <span className="ml-1 opacity-70">
                    ({opportunities.filter(o => o.opportunity_type === pill.value).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Status filter + sort bar (row 2) */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Status filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {FILTER_PILLS.map(pill => (
                <button
                  key={pill.value}
                  onClick={() => setFilter(pill.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === pill.value
                      ? 'bg-[#1B2B6B] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {pill.label}
                  {pill.value !== 'all' && (
                    <span className="ml-1 opacity-70">
                      ({typeFiltered.filter(o => o.status === pill.value).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 bg-white appearance-none pr-7 focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/30 cursor-pointer"
              >
                <option value="priority">Sort: Priority (high first)</option>
                <option value="effort">Sort: Effort (quick first)</option>
                <option value="date">Sort: Date added</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Bulk action bar (shows when rows selected) */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-[#1B2B6B]/5 border border-[#1B2B6B]/20 rounded-xl px-4 py-2.5">
              <span className="text-xs font-medium text-[#1B2B6B]">
                {selectedIds.size} selected
              </span>
              <span className="text-xs text-gray-500">Mark as:</span>
              <select
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value as OpportunityStatus)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={handleBulkStatus}
                disabled={bulkApplying}
                className="px-3 py-1 text-xs font-medium text-white bg-[#1B2B6B] rounded-lg hover:bg-[#152259] disabled:opacity-60"
              >
                {bulkApplying ? 'Applying…' : 'Apply'}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          )}

          {/* Table */}
          {sorted.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-sm text-gray-500">No opportunities match this filter.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="w-8 px-3 py-2.5 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="accent-[#1B2B6B] w-3.5 h-3.5"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Opportunity
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                      Type
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                      Priority
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">
                      Effort
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">
                      Cost
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                      Action
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map(opp => (
                    <tr
                      key={opp.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedIds.has(opp.id) ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(opp.id)}
                          onChange={e => {
                            const next = new Set(selectedIds);
                            e.target.checked ? next.add(opp.id) : next.delete(opp.id);
                            setSelectedIds(next);
                          }}
                          className="accent-[#1B2B6B] w-3.5 h-3.5"
                        />
                      </td>

                      {/* Name + URL */}
                      <td className="px-3 py-3 max-w-[220px]">
                        <a
                          href={opp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gray-900 hover:text-[#1B2B6B] flex items-start gap-1 leading-snug"
                        >
                          <span className="truncate">{opp.name}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 text-gray-400" />
                        </a>
                        {opp.acquisition_method && (
                          <p
                            className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]"
                            title={opp.acquisition_method}
                          >
                            {opp.acquisition_method}
                          </p>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          {TYPE_ICONS[opp.type]}
                          {opp.type_label || TYPE_LABELS[opp.type]}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-3 hidden md:table-cell">
                        {priorityBadge(opp.priority)}
                      </td>

                      {/* Effort */}
                      <td className="px-3 py-3 hidden xl:table-cell">
                        {effortBadge(opp.effort)}
                      </td>

                      {/* Cost */}
                      <td className="px-3 py-3 hidden xl:table-cell">
                        <span className="text-xs text-gray-700">{opp.estimated_cost}</span>
                      </td>

                      {/* Acquisition method / action description */}
                      <td className="px-3 py-3 hidden lg:table-cell max-w-[180px]">
                        <span
                          className="text-xs text-gray-600 line-clamp-2"
                          title={opp.action_description || opp.acquisition_method}
                        >
                          {opp.action_description || opp.acquisition_method || '—'}
                        </span>
                      </td>

                      {/* Status inline dropdown */}
                      <td className="px-3 py-3">
                        <div className="relative">
                          <select
                            value={opp.status}
                            onChange={e => handleInlineStatus(opp.id, e.target.value as OpportunityStatus)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white appearance-none pr-5 focus:outline-none focus:ring-1 focus:ring-[#1B2B6B]/30 cursor-pointer"
                          >
                            {STATUS_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </td>

                      {/* View details */}
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setDrawerOpp(opp)}
                          className="text-xs text-[#1B2B6B] hover:underline whitespace-nowrap"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Drawer */}
      {drawerOpp && (
        <OpportunityDrawer
          opp={drawerOpp}
          onClose={() => setDrawerOpp(null)}
          onSave={async (id, updates) => {
            await updateOpportunity(id, updates);
            setDrawerOpp(null);
          }}
          onDelete={async (id) => {
            await deleteOpportunity(id);
            setDrawerOpp(null);
          }}
        />
      )}

      {/* Add Manual Modal */}
      {showAddModal && (
        <AddManualModal
          clientId={client.id}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

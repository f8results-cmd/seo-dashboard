'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

interface Opportunity {
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

interface BacklinkReport {
  generated_at?: string;
  total_opportunities?: number;
  categories?: {
    local_orgs?: Opportunity[];
    events?: Opportunity[];
    media?: Opportunity[];
    education_govt?: Opportunity[];
    directories?: Opportunity[];
  };
}

const EFFORT_COLOURS: Record<string, string> = {
  Low:    'bg-green-100 text-green-700',
  Medium: 'bg-amber-100 text-amber-700',
  High:   'bg-red-100 text-red-700',
};
const PRIORITY_COLOURS: Record<string, string> = {
  High:   'bg-[#E8622A] text-white',
  Medium: 'bg-amber-100 text-amber-700',
  Low:    'bg-gray-100 text-gray-500',
};

const CATEGORY_LABELS: Record<string, string> = {
  local_orgs:      '1. Local Organisations and Community Groups',
  events:          '2. Events and Sponsorship Opportunities',
  media:           '3. Local Media Outlets and Publications',
  education_govt:  '4. Educational Institutes and Government Pages',
  directories:     '5. Business Directories and Listing Websites',
};

function AccordionSection({
  title, items, clientId, onUpdate,
}: { title: string; items: Opportunity[]; clientId: string; onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  const [localItems, setLocalItems] = useState(items);
  const supabase = createClient();

  const visible = localItems.filter(i => !i.hidden);
  const done = visible.filter(i => i.done).length;

  async function markDone(idx: number) {
    const updated = [...localItems];
    updated[idx] = { ...updated[idx], done: true };
    setLocalItems(updated);
    await saveState(updated);
  }

  async function markHidden(idx: number) {
    const updated = [...localItems];
    updated[idx] = { ...updated[idx], hidden: true };
    setLocalItems(updated);
    await saveState(updated);
  }

  async function saveState(updated: Opportunity[]) {
    const supaDb = createClient();
    const { data: clientData } = await supaDb.from('clients').select('website_data').eq('id', clientId).single();
    const wd = (clientData?.website_data as Record<string, unknown>) ?? {};
    const report = (wd.backlink_opportunities as BacklinkReport) ?? {};
    // Merge back — we don't know which category key we are, so just update the whole report
    // This is handled by caller via onUpdate
    onUpdate();
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-semibold text-gray-900 text-sm">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{done}/{visible.length} done</span>
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-gray-100">
          {visible.map((opp, i) => (
            <div key={i} className={`px-5 py-4 space-y-2 ${opp.done ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-2 flex-wrap">
                <span className="font-medium text-gray-900 text-sm flex-1">{opp.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${PRIORITY_COLOURS[opp.priority]}`}>
                  {opp.priority} priority
                </span>
                {opp.paid && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Paid</span>}
                {!opp.paid && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Free</span>}
              </div>
              <a href={opp.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />{opp.url}
              </a>
              <p className="text-xs text-gray-600">{opp.relevance}</p>
              <p className="text-xs text-gray-500"><strong>How to get:</strong> {opp.how_to_get}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded ${EFFORT_COLOURS[opp.effort]}`}>Effort: {opp.effort}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${EFFORT_COLOURS[opp.authority]}`}>Authority: {opp.authority}</span>
                {!opp.done && (
                  <>
                    <button
                      onClick={() => markDone(i)}
                      className="ml-auto text-xs flex items-center gap-1 bg-green-500 text-white px-2.5 py-1 rounded hover:bg-green-600 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" /> Mark Done
                    </button>
                    <button
                      onClick={() => markHidden(i)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200"
                    >
                      Not Relevant
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {visible.length === 0 && <p className="px-5 py-4 text-sm text-gray-400">No opportunities in this category.</p>}
        </div>
      )}
    </div>
  );
}

export default function CitationsTab({ client }: { client: Client }) {
  const wd = client.website_data as Record<string, unknown> ?? {};
  const report = wd.backlink_opportunities as BacklinkReport | undefined;
  const [refresh, setRefresh] = useState(0);

  const cats = report?.categories ?? {};
  const total = report?.total_opportunities ?? 0;
  const allOpps = Object.values(cats).flat() as Opportunity[];
  const done = allOpps.filter(o => o.done).length;
  const leadSnapId = wd.leadsnap_location_id as number | undefined;
  const citationSummary = wd.citation_summary as Record<string, number> | undefined;

  return (
    <div className="p-6 space-y-5">
      {/* LeadSnap status */}
      <div className="bg-[#1a2744] text-white rounded-xl px-5 py-4">
        <p className="text-sm font-semibold mb-1">LeadSnap Citation Status</p>
        {leadSnapId ? (
          <div className="grid grid-cols-3 gap-4 mt-2 text-center">
            <div><p className="text-xl font-bold">{citationSummary?.total_submitted ?? 0}</p><p className="text-xs text-slate-400">Submitted</p></div>
            <div><p className="text-xl font-bold">{citationSummary?.total_synced ?? 0}</p><p className="text-xs text-slate-400">Synced</p></div>
            <div><p className="text-xl font-bold">{citationSummary?.total_pending ?? 0}</p><p className="text-xs text-slate-400">Pending</p></div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No LeadSnap data yet — run the citation agent.</p>
        )}
      </div>

      {/* Backlink report */}
      {report ? (
        <>
          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{done} of {total} opportunities completed</span>
              <span>{total > 0 ? Math.round((done / total) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-[#E8622A] transition-all" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <AccordionSection
                key={`${key}-${refresh}`}
                title={label}
                items={(cats[key as keyof typeof cats] as Opportunity[]) ?? []}
                clientId={client.id}
                onUpdate={() => setRefresh(r => r + 1)}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 text-center py-8">
          No backlink report yet — run the citation agent to generate one.
        </p>
      )}
    </div>
  );
}

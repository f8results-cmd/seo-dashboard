'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

type BuildStatus = 'to_be_built' | 'being_built' | 'being_reviewed' | 'live';

const STAGES: { key: BuildStatus; label: string }[] = [
  { key: 'to_be_built',    label: 'To be built' },
  { key: 'being_built',    label: 'Being built' },
  { key: 'being_reviewed', label: 'Being reviewed' },
  { key: 'live',           label: 'Live' },
];

interface Props {
  client: Client;
  onUpdate?: () => void;
}

export default function WebsiteStatusBar({ client, onUpdate }: Props) {
  const supabase = createClient();

  const hasWebsite = !client.skip_website;
  const currentStage = (client.onboarding_checklist?.website_build_status ?? null) as BuildStatus | null;

  const [saving, setSaving] = useState(false);

  async function setHasWebsite(value: boolean) {
    setSaving(true);
    await supabase.from('clients').update({ skip_website: !value }).eq('id', client.id);
    setSaving(false);
    onUpdate?.();
  }

  async function setStage(stage: BuildStatus) {
    setSaving(true);
    const existing = client.onboarding_checklist ?? {};
    await supabase
      .from('clients')
      .update({ onboarding_checklist: { ...existing, website_build_status: stage } })
      .eq('id', client.id);
    setSaving(false);
    onUpdate?.();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 flex-shrink-0">Website:</span>

        {/* Yes / No toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => !saving && setHasWebsite(true)}
            disabled={saving}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              hasWebsite
                ? 'bg-[#1a2744] text-white'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => !saving && setHasWebsite(false)}
            disabled={saving}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !hasWebsite
                ? 'bg-gray-500 text-white'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            No
          </button>
        </div>

        {/* Progress stages — only when Yes */}
        {hasWebsite && (
          <>
            <span className="text-gray-200 text-xs select-none flex-shrink-0">|</span>
            <div className="flex items-center gap-1 flex-wrap">
              {STAGES.map((stage, i) => {
                const stageIdx    = STAGES.findIndex(s => s.key === currentStage);
                const isActive    = stage.key === currentStage;
                const isPast      = stageIdx > -1 && i < stageIdx;
                const isLive      = stage.key === 'live' && currentStage === 'live';

                return (
                  <div key={stage.key} className="flex items-center gap-1">
                    {i > 0 && <span className="text-gray-300 text-xs select-none">→</span>}
                    <button
                      onClick={() => !saving && setStage(stage.key)}
                      disabled={saving}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        isLive
                          ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                          : isActive
                          ? 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200'
                          : isPast
                          ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {stage.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

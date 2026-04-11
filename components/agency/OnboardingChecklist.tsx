'use client';

import { useState } from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client, Deliverable } from '@/lib/types';

interface Props {
  client: Client;
  deliverables: Deliverable[];
  gbpPostCount: number;
  onUpdate?: () => void;
}

interface Step {
  label: string;
  key?: keyof NonNullable<Client['onboarding_checklist']>;
  auto: boolean;
  done: boolean;
}

export default function OnboardingChecklist({ client, deliverables, gbpPostCount, onUpdate }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const checklist = client.onboarding_checklist ?? {};
  const hasJob = deliverables.some(d => d.status === 'complete');
  const hasPhotos = !!(client.photos && Object.values(client.photos).some(v => v !== null));

  const steps: Step[] = [
    { label: 'GHL sub-account created', key: 'ghl_created',       auto: false, done: !!checklist.ghl_created },
    { label: 'Location ID added',        key: undefined,            auto: true,  done: !!client.ghl_location_id },
    { label: 'Pipeline run',             key: undefined,            auto: true,  done: hasJob },
    { label: 'GBP connected in GHL',     key: 'gbp_connected',     auto: false, done: !!checklist.gbp_connected },
    { label: '52 posts scheduled',        key: undefined,            auto: true,  done: gbpPostCount >= 52 },
    { label: 'WordPress activated',       key: 'wp_activated',      auto: false, done: !!checklist.wp_activated },
    { label: 'Photos uploaded',           key: undefined,            auto: true,  done: hasPhotos },
    { label: 'First client update sent',  key: 'first_update_sent', auto: false, done: !!checklist.first_update_sent },
  ];

  const complete = steps.filter(s => s.done).length;
  const pct = Math.round((complete / steps.length) * 100);

  async function toggle(key: keyof NonNullable<Client['onboarding_checklist']>) {
    setSaving(key);
    const supabase = createClient();
    const updated = { ...checklist, [key]: !checklist[key as keyof typeof checklist] };
    await supabase.from('clients').update({ onboarding_checklist: updated }).eq('id', client.id);
    setSaving(null);
    onUpdate?.();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Onboarding Checklist</h3>
        <span className="text-sm text-gray-500">{complete} of {steps.length} complete</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-5">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#22c55e' : '#E8622A' }}
        />
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            {step.auto ? (
              <span className={step.done ? 'text-green-500' : 'text-gray-300'}>
                {step.done ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
              </span>
            ) : (
              <button
                onClick={() => step.key && toggle(step.key)}
                disabled={saving === step.key}
                className={`flex-shrink-0 transition-colors ${step.done ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'}`}
              >
                {saving === step.key
                  ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  : step.done
                    ? <CheckCircle className="w-5 h-5" />
                    : <Circle className="w-5 h-5" />
                }
              </button>
            )}
            <span className={`text-sm ${step.done ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
              {step.label}
            </span>
            {step.auto && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-auto">auto</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

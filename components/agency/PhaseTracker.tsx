'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const PHASES = [
  { key: 'gbp_setup',  label: 'Week 1: GBP Setup' },
  { key: 'website',    label: 'Week 1: Website' },
  { key: 'citations',  label: 'Week 2: Citations' },
  { key: 'ongoing',    label: 'Ongoing' },
] as const;

type PhaseKey = typeof PHASES[number]['key'];
type PhaseStatus = 'not_started' | 'in_progress' | 'complete';

const STATUS_STYLES: Record<PhaseStatus, string> = {
  not_started: 'bg-gray-100 text-gray-400 hover:bg-gray-200',
  in_progress: 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200',
  complete:    'bg-green-100 text-green-700 hover:bg-green-200',
};

interface PhaseStats {
  total: number;
  done: number;
}

interface Props {
  clientId: string;
}

export default function PhaseTracker({ clientId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats]   = useState<Map<PhaseKey, PhaseStats>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('client_tasks')
      .select('phase, completed')
      .eq('client_id', clientId)
      .in('phase', ['gbp_setup', 'website', 'citations', 'ongoing'])
      .then(({ data }) => {
        const map = new Map<PhaseKey, PhaseStats>();
        for (const task of (data ?? []) as { phase: PhaseKey; completed: boolean }[]) {
          const s = map.get(task.phase) ?? { total: 0, done: 0 };
          s.total++;
          if (task.completed) s.done++;
          map.set(task.phase, s);
        }
        setStats(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  function getStatus(key: PhaseKey): PhaseStatus {
    const s = stats.get(key);
    if (!s || s.total === 0) return 'not_started';
    if (s.done === s.total) return 'complete';
    return 'in_progress';
  }

  function goToPhase(phaseKey: PhaseKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'todo');
    params.set('phase', phaseKey);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 mr-1 flex-shrink-0">Work Phase:</span>
        {PHASES.map((phase, i) => {
          const status = getStatus(phase.key);
          const s = stats.get(phase.key);
          return (
            <div key={phase.key} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300 text-xs select-none flex-shrink-0">→</span>}
              <button
                onClick={() => goToPhase(phase.key)}
                title={s ? `${s.done}/${s.total} tasks complete` : 'No tasks generated yet'}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${STATUS_STYLES[status]}`}
              >
                {phase.label}
                {s && s.total > 0 && (
                  <span className="ml-1.5 opacity-70">
                    {s.done}/{s.total}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

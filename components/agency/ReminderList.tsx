'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckSquare, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ReminderItem {
  id: string;
  client_id: string;
  client_name: string;
  description: string;
  type: 'friday_update' | 'onboarding' | 'task' | 'rank_screenshot';
  overdue: boolean;
  href: string;
}

const ICON: Record<string, React.ElementType> = {
  friday_update:   Bell,
  onboarding:      AlertTriangle,
  task:            CheckSquare,
  rank_screenshot: Camera,
};

const TYPE_COLOUR: Record<string, string> = {
  friday_update:   'bg-purple-100 text-purple-600',
  onboarding:      'bg-amber-100 text-amber-600',
  task:            'bg-red-100 text-red-600',
  rank_screenshot: 'bg-blue-100 text-blue-600',
};

const TYPE_LABEL: Record<string, string> = {
  friday_update:   'Friday Update',
  onboarding:      'Onboarding',
  task:            'Overdue Task',
  rank_screenshot: 'Rank Screenshot',
};

export default function ReminderList({ initialReminders }: { initialReminders: ReminderItem[] }) {
  const router = useRouter();
  const [reminders, setReminders] = useState(initialReminders);
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  async function handleComplete(reminder: ReminderItem) {
    setCompleting(prev => new Set(prev).add(reminder.id));
    // Optimistically remove
    setReminders(prev => prev.filter(r => r.id !== reminder.id));

    try {
      const res = await fetch('/api/reminders/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reminder.id, type: reminder.type, client_id: reminder.client_id }),
      });
      if (!res.ok) throw new Error('Failed');
      router.refresh();
    } catch {
      // Restore on failure
      setReminders(prev => [...prev, reminder].sort((a, b) => a.id.localeCompare(b.id)));
    } finally {
      setCompleting(prev => {
        const next = new Set(prev);
        next.delete(reminder.id);
        return next;
      });
    }
  }

  if (reminders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-2xl mb-2">🎉</p>
        <p className="text-gray-600 font-medium">All caught up!</p>
        <p className="text-sm text-gray-400 mt-1">No reminders pending.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reminders.map(r => {
        const Icon = ICON[r.type] ?? Bell;
        const isLoading = completing.has(r.id);

        return (
          <div
            key={r.id}
            className="flex items-center bg-white rounded-xl border border-gray-200 hover:border-[#E8622A]/30 hover:shadow-sm transition-all group"
          >
            {/* Clickable link area */}
            <Link
              href={r.href}
              className="flex items-center gap-4 flex-1 min-w-0 px-5 py-4"
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${TYPE_COLOUR[r.type] ?? 'bg-gray-100 text-gray-500'}`}>
                <Icon className="w-4 h-4" />
              </span>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm group-hover:text-[#E8622A] transition-colors">
                  {r.client_name}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
              </div>

              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${TYPE_COLOUR[r.type] ?? 'bg-gray-100 text-gray-500'}`}>
                {TYPE_LABEL[r.type] ?? r.type}
              </span>
            </Link>

            {/* Complete button — outside the link so it never triggers navigation */}
            <div className="pr-4 pl-2 flex-shrink-0">
              <button
                onClick={() => handleComplete(r)}
                disabled={isLoading}
                title="Mark as done"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-500 bg-white hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isLoading ? 'Saving…' : 'Done'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  startOfDay, addDays, parseISO, isToday, isBefore,
  differenceInDays, format, subDays,
} from 'date-fns';
import {
  LayoutDashboard, Users, CheckSquare, UserPlus, Bell, Settings, Menu, X, Inbox,
} from 'lucide-react';

interface SidebarProps {
  reminderCount?: number;
  approvalCount?: number;
}

const NAV = [
  { href: '/agency',           label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/agency/clients',   label: 'Clients',        icon: Users },
  { href: '/agency/approvals', label: 'Approvals',      icon: Inbox,       approvalBadge: true },
  { href: '/agency/todo',      label: 'To Do',          icon: CheckSquare },
  { href: '/agency/onboard',   label: 'Onboard Client', icon: UserPlus },
  { href: '/agency/reminders', label: 'Reminders',      icon: Bell, badge: true },
  { href: '/agency/settings',  label: 'Settings',       icon: Settings },
];

interface WeekTask {
  id: string;
  description: string;
  due_date: string;
  client_id: string;
  clients: { id: string; business_name: string } | null;
}

interface WeekGroup {
  id: string;
  name: string;
  tasks: WeekTask[];
}

function taskColor(dueDate: string): 'red' | 'yellow' | 'green' {
  const today = startOfDay(new Date());
  const due = parseISO(dueDate);
  if (isBefore(due, today) || isToday(due)) return 'red';
  const days = differenceInDays(due, today);
  if (days <= 2) return 'yellow';
  return 'green';
}

function dueLabel(dueDate: string): string {
  const today = startOfDay(new Date());
  const due = parseISO(dueDate);
  if (isBefore(due, today)) return 'overdue';
  if (isToday(due)) return 'today';
  const days = differenceInDays(due, today);
  if (days === 1) return 'tomorrow';
  return format(due, 'EEE');
}

const DOT_COLOR: Record<string, string> = {
  red:    'bg-red-500',
  yellow: 'bg-yellow-400',
  green:  'bg-green-400',
};

const LABEL_COLOR: Record<string, string> = {
  red:    'text-red-400',
  yellow: 'text-yellow-300',
  green:  'text-green-400',
};

function NavLinks({
  onClose,
  isActive,
  reminderCount,
  approvalCount,
}: {
  onClose?: () => void;
  isActive: (href: string) => boolean;
  reminderCount: number;
  approvalCount: number;
}) {
  return (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      {NAV.map(({ href, label, icon: Icon, badge, approvalBadge }) => (
        <Link
          key={href}
          href={href}
          onClick={onClose}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${isActive(href)
              ? 'bg-[#E8622A] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">{label}</span>
          {badge && reminderCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
              {reminderCount > 99 ? '99+' : reminderCount}
            </span>
          )}
          {approvalBadge && approvalCount > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
              {approvalCount > 99 ? '99+' : approvalCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

function WeekSection({
  onClose,
  weekGroups,
  fridayDue,
  weekLoading,
}: {
  onClose?: () => void;
  weekGroups: WeekGroup[];
  fridayDue: { id: string; business_name: string }[];
  weekLoading: boolean;
}) {
  return (
    <div className="px-3 pb-4">
      <div className="border-t border-white/10 pt-3 mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">This Week</span>
        <Link
          href="/agency/todo"
          onClick={onClose}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          View all
        </Link>
      </div>

      {/* Friday update reminders — only Thu/Fri */}
      {fridayDue.length > 0 && (
        <div className="mb-3 bg-amber-500/10 rounded-lg p-2 border border-amber-500/20">
          <p className="text-[10px] font-semibold text-amber-400 mb-1.5">⚠️ Friday updates due:</p>
          <div className="space-y-1">
            {fridayDue.map(c => (
              <Link
                key={c.id}
                href={`/agency/clients/${c.id}?tab=friday`}
                onClick={onClose}
                className="block text-xs text-amber-300 hover:text-amber-200 transition-colors truncate"
              >
                {c.business_name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {weekLoading ? (
        <p className="text-xs text-slate-600 py-1">Loading…</p>
      ) : weekGroups.length === 0 ? (
        <p className="text-xs text-slate-600 py-1">No tasks due this week.</p>
      ) : (
        <div className="space-y-3">
          {weekGroups.map(group => (
            <div key={group.id}>
              <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide truncate mb-1">
                {group.name}
              </p>
              <div className="space-y-1.5 pl-0.5">
                {group.tasks.map(task => {
                  const color = taskColor(task.due_date);
                  return (
                    <Link
                      key={task.id}
                      href={`/agency/clients/${group.id}?tab=todo`}
                      onClick={onClose}
                      className="flex items-start gap-1.5 group/task"
                    >
                      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-[5px] ${DOT_COLOR[color]}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-400 group-hover/task:text-slate-200 transition-colors block truncate leading-[1.3]">
                          {task.description}
                        </span>
                        <span className={`text-[10px] ${LABEL_COLOR[color]}`}>
                          {dueLabel(task.due_date)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgencySidebar({ reminderCount = 0 }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const [weekGroups, setWeekGroups]   = useState<WeekGroup[]>([]);
  const [fridayDue, setFridayDue]     = useState<{ id: string; business_name: string }[]>([]);
  const [weekLoading, setWeekLoading] = useState(true);
  const [approvalCount, setApprovalCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const today = startOfDay(new Date());
    const nextWeek = addDays(today, 7).toISOString().split('T')[0];
    const dayOfWeek = today.getDay(); // 0=Sun, 4=Thu, 5=Fri
    const isThuOrFri = dayOfWeek === 4 || dayOfWeek === 5;

    const fetchAll = async () => {
      const { data: taskData } = await supabase
        .from('client_tasks')
        .select('id, description, due_date, client_id, clients(id, business_name)')
        .eq('completed', false)
        .not('due_date', 'is', null)
        .lte('due_date', nextWeek)
        .order('due_date')
        .limit(8);

      const map = new Map<string, WeekGroup>();
      for (const task of (taskData ?? []) as unknown as WeekTask[]) {
        const cid = task.client_id;
        const name = task.clients?.business_name ?? 'Unknown';
        if (map.has(cid)) {
          map.get(cid)!.tasks.push(task);
        } else {
          map.set(cid, { id: cid, name, tasks: [task] });
        }
      }
      setWeekGroups(Array.from(map.values()));

      if (isThuOrFri) {
        const sixDaysAgo = subDays(today, 6).toISOString();
        const { data: activeClients } = await supabase
          .from('clients')
          .select('id, business_name, last_friday_update')
          .eq('status', 'active');
        const due = (activeClients ?? []).filter(
          (c: { id: string; business_name: string; last_friday_update: string | null }) =>
            !c.last_friday_update || c.last_friday_update < sixDaysAgo,
        );
        setFridayDue(due);
      }

      // Approval count — non-blocking, fails gracefully if table doesn't exist
      try {
        const { count } = await supabase
          .from('approval_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');
        setApprovalCount(count ?? 0);
      } catch {
        // Table may not exist yet
      }

      setWeekLoading(false);
    };

    fetchAll();
  }, []);

  function isActive(href: string) {
    if (href === '/agency') return pathname === '/agency';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Desktop sidebar — fixed, 240px */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[240px] bg-[#1a2744] z-30 border-r border-white/5">
        <div className="px-5 py-5 border-b border-white/10 flex-shrink-0">
          <div className="text-white font-bold text-base leading-tight">Figure 8 Results</div>
          <div className="text-slate-400 text-xs mt-0.5">Agency Portal</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks isActive={isActive} reminderCount={reminderCount} approvalCount={approvalCount} />
          <WeekSection weekGroups={weekGroups} fridayDue={fridayDue} weekLoading={weekLoading} />
        </div>
        <div className="px-5 py-4 border-t border-white/10 text-slate-500 text-xs flex-shrink-0">
          © {new Date().getFullYear()} Figure 8 Results
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[#1a2744] flex items-center px-4 border-b border-white/10">
        <button onClick={() => setOpen(!open)} className="text-white p-1 rounded" aria-label="Menu">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <span className="text-white font-bold ml-3 text-sm">Figure 8 Results</span>
        {reminderCount > 0 && (
          <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
            {reminderCount}
          </span>
        )}
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setOpen(false)}>
          <aside className="w-[240px] h-full bg-[#1a2744] flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-5 mt-14 border-b border-white/10 flex-shrink-0">
              <div className="text-white font-bold">Figure 8 Results</div>
            </div>
            <NavLinks onClose={() => setOpen(false)} isActive={isActive} reminderCount={reminderCount} approvalCount={approvalCount} />
            <WeekSection onClose={() => setOpen(false)} weekGroups={weekGroups} fridayDue={fridayDue} weekLoading={weekLoading} />
          </aside>
        </div>
      )}
    </>
  );
}

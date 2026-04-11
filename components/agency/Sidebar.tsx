'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, CheckSquare, UserPlus, Bell, Settings, Menu, X,
} from 'lucide-react';

interface SidebarProps {
  reminderCount?: number;
}

const NAV = [
  { href: '/agency',           label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/agency/clients',   label: 'Clients',        icon: Users },
  { href: '/agency/todo',      label: 'To Do',          icon: CheckSquare },
  { href: '/agency/onboard',   label: 'Onboard Client', icon: UserPlus },
  { href: '/agency/reminders', label: 'Reminders',      icon: Bell, badge: true },
  { href: '/agency/settings',  label: 'Settings',       icon: Settings },
];

export default function AgencySidebar({ reminderCount = 0 }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/agency') return pathname === '/agency';
    return pathname.startsWith(href);
  }

  function NavItems({ onClick }: { onClick?: () => void }) {
    return (
      <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1">
        {NAV.map(({ href, label, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            onClick={onClick}
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
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <>
      {/* Desktop sidebar — fixed, 240px */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[240px] bg-[#1a2744] z-30 border-r border-white/5">
        <div className="px-5 py-5 border-b border-white/10 flex-shrink-0">
          <div className="text-white font-bold text-base leading-tight">Figure 8 Results</div>
          <div className="text-slate-400 text-xs mt-0.5">Agency Portal</div>
        </div>
        <NavItems />
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
          <aside className="w-[240px] h-full bg-[#1a2744] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-5 mt-14 border-b border-white/10">
              <div className="text-white font-bold">Figure 8 Results</div>
            </div>
            <NavItems onClick={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

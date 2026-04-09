'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function NotificationBell() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ count: reviews }, { count: failed }] = await Promise.all([
        supabase
          .from('review_responses')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .in('status', ['error', 'failed']),
      ]);
      setTotal((reviews ?? 0) + (failed ?? 0));
    }
    load();
  }, []);

  return (
    <Link
      href="/agency/action-items"
      className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors"
      title="Notifications"
    >
      <svg className="w-5 h-5 text-blue-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {total > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 bg-[#E8622A] text-white text-[10px] font-bold rounded-full leading-none">
          {total > 99 ? '99+' : total}
        </span>
      )}
    </Link>
  );
}

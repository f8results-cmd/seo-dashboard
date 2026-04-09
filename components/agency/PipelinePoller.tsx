'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * When the pipeline is actively running (status='running'),
 * refresh the page data every 30 seconds so the job status stays current.
 */
export default function PipelinePoller({ isRunning }: { isRunning: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      router.refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [isRunning, router]);

  if (!isRunning) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
      </span>
      Pipeline running — refreshing every 30s
    </div>
  );
}

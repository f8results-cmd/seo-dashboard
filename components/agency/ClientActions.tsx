'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ClientStatus } from '@/lib/types';

export default function ClientActions({
  clientId,
  status,
  liveUrl,
}: {
  clientId: string;
  status: ClientStatus;
  liveUrl: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function triggerPipeline() {
    setLoading('pipeline');
    setMessage('');
    const url = process.env.NEXT_PUBLIC_RAILWAY_URL;
    if (!url) {
      setMessage('NEXT_PUBLIC_RAILWAY_URL not configured');
      setLoading(null);
      return;
    }
    try {
      const res = await fetch(`${url}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      });
      setMessage(res.ok ? 'Pipeline triggered!' : 'Pipeline trigger failed');
    } catch {
      setMessage('Failed to reach Railway server');
    }
    setLoading(null);
    router.refresh();
  }

  async function retryFailed() {
    setLoading('retry');
    setMessage('');
    const url = process.env.NEXT_PUBLIC_RAILWAY_URL;
    if (!url) {
      setMessage('NEXT_PUBLIC_RAILWAY_URL not configured');
      setLoading(null);
      return;
    }
    try {
      const res = await fetch(`${url}/retry/${clientId}`, { method: 'POST' });
      setMessage(res.ok ? 'Retry triggered!' : 'Retry failed');
    } catch {
      setMessage('Failed to reach Railway server');
    }
    setLoading(null);
    router.refresh();
  }

  async function setStatus(newStatus: ClientStatus) {
    setLoading(`status-${newStatus}`);
    const supabase = createClient();
    await supabase.from('clients').update({ status: newStatus }).eq('id', clientId);
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          onClick={triggerPipeline}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-navy-500 text-white text-sm font-medium rounded-lg hover:bg-navy-600 disabled:opacity-60 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
          </svg>
          {loading === 'pipeline' ? 'Running...' : 'Run Pipeline'}
        </button>
        <button
          onClick={retryFailed}
          disabled={!!loading}
          className="px-3.5 py-2 bg-orange-DEFAULT text-white text-sm font-medium rounded-lg hover:bg-orange-500 disabled:opacity-60 transition-colors"
        >
          {loading === 'retry' ? 'Retrying...' : 'Retry Failed'}
        </button>
        {status !== 'active' && (
          <button
            onClick={() => setStatus('active')}
            disabled={!!loading}
            className="px-3.5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            Mark Active
          </button>
        )}
        {status !== 'inactive' && (
          <button
            onClick={() => setStatus('inactive')}
            disabled={!!loading}
            className="px-3.5 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 disabled:opacity-60 transition-colors"
          >
            Mark Inactive
          </button>
        )}
      </div>
      {message && (
        <p className="text-xs text-gray-500">{message}</p>
      )}
    </div>
  );
}

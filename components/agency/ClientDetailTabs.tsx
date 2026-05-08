'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Client } from '@/lib/types';
import RolloutChecklistTab  from './tabs/RolloutChecklistTab';
import GBPSetupTab          from './tabs/GBPSetupTab';
import GBPPostsTab          from './tabs/GBPPostsTab';
import WebsiteTab           from './tabs/WebsiteTab';
import PhotosTab            from './tabs/PhotosTab';
import BacklinksTab         from './tabs/BacklinksTab';
import RankTrackingTab      from './tabs/RankTrackingTab';
import FridayUpdateTab      from './tabs/FridayUpdateTab';
import MonthlyMetricsTab    from './tabs/MonthlyMetricsTab';

interface Props {
  client: Client;
  onRefresh?: () => void;
}

const TABS = [
  { id: 'rollout',         label: 'Rollout Checklist' },
  { id: 'gbp-setup',      label: 'GBP Setup' },
  { id: 'gbp-posts',      label: 'GBP Posts' },
  { id: 'website',        label: 'Website' },
  { id: 'photos',         label: 'Photos' },
  { id: 'backlinks',      label: 'Backlinks & Citations' },
  { id: 'rank-tracking',  label: 'Rank Tracking' },
  { id: 'monthly-metrics',label: 'Monthly Metrics' },
  { id: 'friday',         label: 'Friday Updates' },
];

function renderTabContent(tabId: string, client: Client, onRefresh?: () => void) {
  switch (tabId) {
    case 'rollout':          return <RolloutChecklistTab client={client} />;
    case 'gbp-setup':        return <GBPSetupTab client={client} />;
    case 'gbp-posts':        return <GBPPostsTab client={client} />;
    case 'website':          return <WebsiteTab client={client} />;
    case 'photos':           return <PhotosTab client={client} onUpdate={onRefresh} />;
    case 'backlinks':        return <BacklinksTab client={client} />;
    case 'rank-tracking':    return <RankTrackingTab clientId={client.id} />;
    case 'monthly-metrics':  return <MonthlyMetricsTab client={client} />;
    case 'friday':           return <FridayUpdateTab client={client} />;
    default:                 return null;
  }
}

export default function ClientDetailTabs({ client, onRefresh }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') ?? 'rollout';

  const validActiveTab = TABS.some(t => t.id === activeTab) ? activeTab : 'rollout';
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(() => new Set([validActiveTab]));

  function setTab(id: string) {
    setLoadedTabs(prev => new Set(Array.from(prev).concat(id)));
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${validActiveTab === tab.id
                ? 'border-[#E8622A] text-[#E8622A] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {TABS.map(tab =>
          loadedTabs.has(tab.id) ? (
            <div key={tab.id} style={{ display: validActiveTab === tab.id ? 'block' : 'none' }}>
              {renderTabContent(tab.id, client, onRefresh)}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

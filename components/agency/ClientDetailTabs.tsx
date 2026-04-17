'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Client } from '@/lib/types';
import TodoTab        from './tabs/TodoTab';
import ActivityLogTab from './tabs/ActivityLogTab';
import FridayUpdateTab from './tabs/FridayUpdateTab';
import GBPSetupTab    from './tabs/GBPSetupTab';
import GBPPostsTab    from './tabs/GBPPostsTab';
import WebsiteTab     from './tabs/WebsiteTab';
import CitationsTab   from './tabs/CitationsTab';
import RankTrackingTab from './tabs/RankTrackingTab';
import PhotosTab      from './tabs/PhotosTab';
import PipelineTab    from './tabs/PipelineTab';
import CategoriesTab  from './tabs/CategoriesTab';

interface Props {
  client: Client;
  onRefresh?: () => void;
}

const TABS = [
  { id: 'todo',         label: 'To Do' },
  { id: 'activity',     label: 'Activity Log' },
  { id: 'friday',       label: 'Friday Update' },
  { id: 'gbp-setup',    label: 'GBP Setup' },
  { id: 'gbp-posts',    label: 'GBP Posts' },
  { id: 'categories',   label: 'Categories' },
  { id: 'website',      label: 'Website' },
  { id: 'citations',    label: 'Citations' },
  { id: 'rank',         label: 'Rank Tracking' },
  { id: 'photos',       label: 'Photos' },
  { id: 'pipeline',     label: 'Pipeline' },
];

function renderTabContent(tabId: string, client: Client, onRefresh?: () => void) {
  switch (tabId) {
    case 'todo':      return <TodoTab client={client} onUpdate={onRefresh} />;
    case 'activity':  return <ActivityLogTab clientId={client.id} />;
    case 'friday':    return <FridayUpdateTab client={client} />;
    case 'gbp-setup': return <GBPSetupTab client={client} />;
    case 'gbp-posts':   return <GBPPostsTab clientId={client.id} locationId={client.ghl_location_id ?? ''} />;
    case 'categories':  return <CategoriesTab client={client} />;
    case 'website':     return <WebsiteTab client={client} />;
    case 'citations': return <CitationsTab client={client} />;
    case 'rank':      return <RankTrackingTab clientId={client.id} />;
    case 'photos':    return <PhotosTab client={client} onUpdate={onRefresh} />;
    case 'pipeline':  return <PipelineTab client={client} />;
    default:          return <TodoTab client={client} onUpdate={onRefresh} />;
  }
}

export default function ClientDetailTabs({ client, onRefresh }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') ?? 'todo';

  // Track which tabs have been visited — each tab mounts once and stays in the DOM
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(() => new Set([activeTab]));

  function setTab(id: string) {
    setLoadedTabs(prev => new Set(Array.from(prev).concat(id)));
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-[#E8622A] text-[#E8622A] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — only mount each tab on first visit, then show/hide to avoid re-fetching */}
      <div>
        {TABS.map(tab =>
          loadedTabs.has(tab.id) ? (
            <div key={tab.id} style={{ display: activeTab === tab.id ? 'block' : 'none' }}>
              {renderTabContent(tab.id, client, onRefresh)}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

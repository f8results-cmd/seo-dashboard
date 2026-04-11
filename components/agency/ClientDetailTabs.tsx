'use client';

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
  { id: 'website',      label: 'Website' },
  { id: 'citations',    label: 'Citations' },
  { id: 'rank',         label: 'Rank Tracking' },
  { id: 'photos',       label: 'Photos' },
  { id: 'pipeline',     label: 'Pipeline' },
];

export default function ClientDetailTabs({ client, onRefresh }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') ?? 'todo';

  function setTab(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function renderTab() {
    switch (activeTab) {
      case 'todo':      return <TodoTab clientId={client.id} />;
      case 'activity':  return <ActivityLogTab clientId={client.id} />;
      case 'friday':    return <FridayUpdateTab client={client} />;
      case 'gbp-setup': return <GBPSetupTab client={client} />;
      case 'gbp-posts': return <GBPPostsTab clientId={client.id} />;
      case 'website':   return <WebsiteTab client={client} />;
      case 'citations': return <CitationsTab client={client} />;
      case 'rank':      return <RankTrackingTab clientId={client.id} />;
      case 'photos':    return <PhotosTab client={client} onUpdate={onRefresh} />;
      case 'pipeline':  return <PipelineTab client={client} />;
      default:          return <TodoTab clientId={client.id} />;
    }
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

      {/* Tab content */}
      <div>{renderTab()}</div>
    </div>
  );
}

'use client';

import { ExternalLink, Github, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import type { Client } from '@/lib/types';

interface PageEntry {
  page_type: string;
  slug: string;
  url: string;
  title: string;
  meta_title?: string;
}

interface TreeNode {
  label: string;
  url: string;
  meta_title?: string;
  children: TreeNode[];
}

function buildTree(pages: PageEntry[]): TreeNode[] {
  const homepage = pages.find(p => p.page_type === 'homepage');
  const categories = pages.filter(p => p.page_type === 'gbp_category');
  const services = pages.filter(p => p.page_type === 'service');
  const suburbs = pages.filter(p => p.page_type === 'suburb');
  const staticPages = pages.filter(p => ['about', 'contact', 'service_areas'].includes(p.page_type));

  const catNodes: TreeNode[] = categories.map(cat => ({
    label: cat.title || cat.slug,
    url: cat.url,
    meta_title: cat.meta_title,
    children: services
      .filter(s => s.slug.includes(cat.slug.split('/').pop() ?? ''))
      .map(s => ({ label: s.title || s.slug, url: s.url, meta_title: s.meta_title, children: [] })),
  }));

  const suburbNodes: TreeNode[] = suburbs.map(s => ({
    label: s.title || s.slug,
    url: s.url,
    children: [],
  }));

  const root: TreeNode[] = [
    { label: 'Homepage', url: '/', meta_title: homepage?.meta_title, children: [
      ...staticPages.map(p => ({ label: p.title || p.page_type, url: p.url, children: [] })),
      ...catNodes,
      ...suburbNodes,
    ]},
  ];

  return root;
}

function TreeRow({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const indent = depth * 20;
  return (
    <>
      <div className="flex items-center gap-2 py-1.5 hover:bg-gray-50 rounded px-2" style={{ paddingLeft: indent + 8 }}>
        {depth > 0 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
        <span className="text-xs text-gray-600 flex-1 truncate">{node.url}</span>
        <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[200px]">{node.meta_title ?? node.label}</span>
        {node.url !== '/' && (
          <a href={node.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-gray-300 hover:text-[#E8622A]">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {node.children.map((child, i) => (
        <TreeRow key={i} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

function StatusCard({ label, value, ok }: { label: string; value: string | null; ok: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
      {ok ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        {value
          ? <a href={value.startsWith('http') ? value : undefined} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#1a2744] hover:underline truncate block">{value}</a>
          : <p className="text-sm text-gray-400">Not set</p>
        }
      </div>
    </div>
  );
}

export default function WebsiteTab({ client }: { client: Client }) {
  const wd = client.website_data as Record<string, unknown> ?? {};
  const manifest = wd.page_manifest as { pages?: PageEntry[] } | undefined;
  const pages: PageEntry[] = manifest?.pages ?? [];
  const tree = buildTree(pages);

  return (
    <div className="p-6 space-y-6">
      {/* Connection status */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Connection Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatusCard label="Live URL" value={client.live_url} ok={!!client.live_url} />
          <StatusCard label="GitHub Repo" value={client.github_repo ? `github.com/${client.github_repo}` : null} ok={!!client.github_repo} />
          <StatusCard label="GHL Connected" value={client.ghl_location_id ?? null} ok={!!client.ghl_location_id} />
          <StatusCard label="WordPress" value={client.wp_url} ok={!!client.wp_url} />
        </div>
      </div>

      {/* Site structure */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-1">Site Structure</h3>
        <p className="text-xs text-gray-500 mb-3">{pages.length} pages in manifest</p>
        {pages.length === 0 ? (
          <p className="text-sm text-gray-400">No page manifest yet — run the content agent.</p>
        ) : (
          <div className="border border-gray-200 rounded-xl bg-gray-50 p-2 font-mono">
            {tree.map((node, i) => <TreeRow key={i} node={node} />)}
          </div>
        )}
      </div>
    </div>
  );
}

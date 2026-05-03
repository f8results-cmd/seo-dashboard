'use client';

import { useState } from 'react';
import { ExternalLink, CheckCircle, XCircle, ChevronRight, ChevronDown, ChevronUp, RefreshCw, BarChart3 } from 'lucide-react';
import type { Client } from '@/lib/types';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

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
      .filter(s => s.slug?.includes(cat.slug?.split('/').pop() ?? ''))
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

function Ga4SetupGuide({ businessName, city, liveUrl }: { businessName: string; city: string | null; liveUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const tz = city ? `Australia / ${city}` : 'Australia / Sydney';
  const url = liveUrl ?? 'your-website.com.au';

  const steps: React.ReactNode[] = [
    <>Go to <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-[#E8622A] underline">analytics.google.com</a> signed in with the figure8results Google account</>,
    <>Click <strong>Admin</strong> (gear icon, bottom left)</>,
    <>Click <strong>Create → Property</strong></>,
    <>Property name: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{businessName}</code></>,
    <>Reporting time zone: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{tz}</code></>,
    <>Currency: <strong>AUD</strong> — then click Next, fill in industry, click Create</>,
    <>Set up a data stream: choose <strong>Web</strong></>,
    <>Website URL: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{url}</code></>,
    <>Stream name: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{businessName}</code> — click Create stream</>,
    <>Copy the <strong>Measurement ID</strong> (starts with G-) shown at the top of the data stream</>,
    <>Paste it into the <strong>Analytics &amp; Tracking</strong> section of Edit Client and save</>,
    <>Click <strong>Redeploy with analytics</strong> button above — wait ~5 minutes</>,
    <>Wait 24 hours — GA4 begins collecting data automatically</>,
  ];

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
      >
        <span>How to set up GA4 for this client</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="p-5 border-t border-gray-200">
          <ol className="space-y-2.5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#E8622A]/10 text-[#E8622A] text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
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
  const [redeploying, setRedeploying] = useState(false);
  const [redeployMsg, setRedeployMsg] = useState('');

  async function handleRedeploy() {
    if (!RAILWAY_URL) return;
    setRedeploying(true);
    setRedeployMsg('');
    try {
      const res = await fetch(`${RAILWAY_URL}/redeploy/${client.id}`, { method: 'POST' });
      setRedeployMsg(res.ok ? 'Redeploy triggered — site will update in ~10 minutes.' : `Error: ${res.status}`);
    } catch {
      setRedeployMsg('Failed to reach backend.');
    }
    setRedeploying(false);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Connection status */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Connection Status</h3>
          <div className="flex items-center gap-2">
            {client.google_tag_id && (
              <a
                href="https://analytics.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full hover:bg-green-100 transition-colors"
              >
                <BarChart3 className="w-3 h-3" /> GA4 {client.google_tag_id}
              </a>
            )}
            {client.live_url && (
              <button
                onClick={handleRedeploy}
                disabled={redeploying}
                className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${redeploying ? 'animate-spin' : ''}`} />
                {redeploying ? 'Redeploying…' : 'Redeploy with analytics'}
              </button>
            )}
          </div>
        </div>
        {redeployMsg && <p className={`text-xs mb-2 ${redeployMsg.startsWith('Error') || redeployMsg.startsWith('Failed') ? 'text-red-500' : 'text-green-600'}`}>{redeployMsg}</p>}
        {!client.google_tag_id && (
          <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            GA4 not configured — add a Measurement ID (G-XXXXXXXXXX) in Edit Client to enable analytics tracking.
          </div>
        )}
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

      {/* GA4 setup guide */}
      <Ga4SetupGuide
        businessName={client.business_name}
        city={client.city ?? null}
        liveUrl={client.live_url}
      />
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

interface HeatmapScan {
  id: string;
  client_id: string;
  scan_date: string;
  keyword: string;
  grid_data: { screenshot_url: string; notes?: string; scan_type?: string };
  average_rank: number;
  top_rank: number;
  coverage_percentage: number;
}

export default function RankTrackingTab({ clientId }: { clientId: string }) {
  const [scans, setScans] = useState<HeatmapScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [keyword, setKeyword] = useState('');
  const [scanType, setScanType] = useState<'primary' | 'secondary'>('primary');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState<File | null>(null);
  const [avgRank, setAvgRank] = useState('');
  const [topRank, setTopRank] = useState('');
  const [coverage, setCoverage] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('heatmap_results')
      .select('*')
      .eq('client_id', clientId)
      .order('scan_date', { ascending: false });
    setScans(data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !keyword.trim()) return;
    setUploading(true);
    setMsg('');

    const safeKeyword = keyword.trim().toLowerCase().replace(/\s+/g, '-');
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `rank-tracking/${clientId}/${date}-${safeKeyword}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from('rank-tracking')
      .upload(path, file, { upsert: true });

    if (storageError) {
      setMsg(`Upload failed: ${storageError.message}`);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('rank-tracking').getPublicUrl(path);

    const { error: dbError } = await supabase.from('heatmap_results').insert({
      client_id: clientId,
      scan_date: date,
      keyword: keyword.trim(),
      grid_data: { screenshot_url: publicUrl, notes: notes.trim() || undefined, scan_type: scanType },
      average_rank: parseFloat(avgRank),
      top_rank: parseInt(topRank),
      coverage_percentage: parseFloat(coverage),
    });

    if (dbError) {
      setMsg(`Save failed: ${dbError.message}`);
    } else {
      setKeyword(''); setNotes(''); setAvgRank(''); setTopRank(''); setCoverage('');
      setFile(null); setScanType('primary');
      setDate(new Date().toISOString().split('T')[0]);
      setMsg('Scan saved.');
      load();
    }
    setUploading(false);
  }

  function getTrend(scan: HeatmapScan, index: number): 'up' | 'down' | 'none' {
    const prev = scans.slice(index + 1).find(s => s.keyword === scan.keyword);
    if (!prev) return 'none';
    if (scan.coverage_percentage > prev.coverage_percentage) return 'up';
    if (scan.coverage_percentage < prev.coverage_percentage) return 'down';
    return 'none';
  }

  const bestKeyword = scans.length > 0
    ? scans.reduce((best, s) => s.coverage_percentage > best.coverage_percentage ? s : best, scans[0])
    : null;
  const avgRankAll = scans.length > 0
    ? (scans.reduce((sum, s) => sum + s.average_rank, 0) / scans.length).toFixed(1)
    : '—';
  const lastScanDate = scans.length > 0 ? scans[0].scan_date : null;

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-6 space-y-6">

      {/* Summary cards */}
      {scans.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Best Keyword</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{bestKeyword?.keyword ?? '—'}</p>
            {bestKeyword && <p className="text-xs text-green-600 mt-0.5">{bestKeyword.coverage_percentage}% coverage</p>}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Avg Rank</p>
            <p className="text-2xl font-bold text-gray-900">{avgRankAll}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Scans</p>
            <p className="text-2xl font-bold text-gray-900">{scans.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Last Scan</p>
            <p className="text-sm font-semibold text-gray-900">
              {lastScanDate ? format(new Date(lastScanDate), 'd MMM yyyy') : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Section 1 — Upload Benchmark Scan */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Upload Benchmark Scan</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Keyword <span className="text-red-400">*</span></label>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="e.g. plumber Sydney"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Scan Type</label>
              <select
                value={scanType}
                onChange={e => setScanType(e.target.value as 'primary' | 'secondary')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              >
                <option value="primary">Primary Category</option>
                <option value="secondary">Secondary Category</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Average Rank <span className="text-red-400">*</span></label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={avgRank}
                onChange={e => setAvgRank(e.target.value)}
                placeholder="e.g. 4.2"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Top Rank <span className="text-red-400">*</span></label>
              <input
                type="number"
                min="1"
                value={topRank}
                onChange={e => setTopRank(e.target.value)}
                placeholder="e.g. 1"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Coverage % (top 3) <span className="text-red-400">*</span></label>
              <input
                type="number"
                min="0"
                max="100"
                value={coverage}
                onChange={e => setCoverage(e.target.value)}
                placeholder="e.g. 68"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes…"
                rows={1}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 resize-none"
              />
            </div>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-6 px-4 cursor-pointer hover:border-[#E8622A] transition-colors">
            <Upload className="w-5 h-5 text-gray-400 mb-1.5" />
            <span className="text-sm text-gray-500">{file ? file.name : 'Click or drag LeadSnap screenshot here'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>

          {msg && <p className={`text-sm ${msg.includes('failed') || msg.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}
          <button
            type="submit"
            disabled={!file || !keyword.trim() || !avgRank || !topRank || !coverage || uploading}
            className="bg-[#1a2744] text-white px-5 py-2 rounded-lg text-sm hover:bg-[#243460] transition-colors disabled:opacity-40"
          >
            {uploading ? 'Saving…' : 'Save Scan'}
          </button>
        </form>
      </div>

      {/* Section 2 — Benchmark History */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Benchmark History</h3>
        {scans.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No scans uploaded yet.</p>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Keyword</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Rank</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Top Rank</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Coverage %</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Trend</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Screenshot</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scans.map((scan, index) => {
                  const trend = getTrend(scan, index);
                  const gd = scan.grid_data as { screenshot_url?: string; notes?: string; scan_type?: string };
                  return (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {format(new Date(scan.scan_date), 'd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{scan.keyword}</div>
                        {gd.scan_type && (
                          <div className="text-xs text-gray-400 capitalize">{gd.scan_type}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{scan.average_rank}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{scan.top_rank}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${scan.coverage_percentage >= 70 ? 'text-green-600' : scan.coverage_percentage >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {scan.coverage_percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500 inline" />}
                        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400 inline" />}
                        {trend === 'none' && <Minus className="w-4 h-4 text-gray-300 inline" />}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {gd.screenshot_url ? (
                          <button onClick={() => setLightbox(gd.screenshot_url!)} className="inline-block">
                            <img
                              src={gd.screenshot_url}
                              alt="Heatmap"
                              className="w-12 h-8 object-cover rounded border border-gray-200 hover:border-[#E8622A] transition-colors"
                            />
                          </button>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{gd.notes ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Full size heatmap" className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}

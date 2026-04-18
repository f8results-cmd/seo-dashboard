'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, TrendingUp, TrendingDown, Minus, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

interface HeatmapScan {
  id: string;
  client_id: string;
  scan_date: string;
  keyword: string;
  grid_data: { screenshot_url?: string; notes?: string; scan_type?: string };
  average_rank: number;
  top_rank: number;
  coverage_percentage: number;
}

interface EditForm {
  keyword: string;
  scan_date: string;
  average_rank: string;
  top_rank: string;
  coverage_percentage: string;
  notes: string;
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30';

function validateCoverage(val: string): { value: string; error: string } {
  if (val === '') return { value: '', error: '' };
  const rounded = Math.round(parseFloat(val));
  return {
    value: rounded.toString(),
    error: rounded < 0 || rounded > 100 ? 'Enter a percentage between 0 and 100' : '',
  };
}

export default function RankTrackingTab({ clientId }: { clientId: string }) {
  const [scans, setScans] = useState<HeatmapScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [keyword, setKeyword] = useState('');
  const [scanType, setScanType] = useState<'primary' | 'secondary'>('primary');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState<File | null>(null);
  const [avgRank, setAvgRank] = useState('');
  const [topRank, setTopRank] = useState('');
  const [coverage, setCoverage] = useState('');
  const [coverageError, setCoverageError] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Edit / delete state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    keyword: '', scan_date: '', average_rank: '', top_rank: '', coverage_percentage: '', notes: '',
  });
  const [editCoverageError, setEditCoverageError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    if (!file || !keyword.trim() || coverageError) return;
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
      coverage_percentage: parseInt(coverage),
    });

    if (dbError) {
      setMsg(`Save failed: ${dbError.message}`);
    } else {
      setKeyword(''); setNotes(''); setAvgRank(''); setTopRank('');
      setCoverage(''); setCoverageError('');
      setFile(null); setScanType('primary');
      setDate(new Date().toISOString().split('T')[0]);
      setMsg('Scan saved.');
      load();
    }
    setUploading(false);
  }

  function startEdit(scan: HeatmapScan) {
    const gd = scan.grid_data as { screenshot_url?: string; notes?: string; scan_type?: string };
    setEditingId(scan.id);
    setEditForm({
      keyword: scan.keyword,
      scan_date: scan.scan_date,
      average_rank: scan.average_rank.toString(),
      top_rank: scan.top_rank.toString(),
      coverage_percentage: scan.coverage_percentage.toString(),
      notes: gd.notes ?? '',
    });
    setEditCoverageError('');
  }

  async function handleSave(scan: HeatmapScan) {
    if (editCoverageError) return;
    setSaving(true);
    const gd = scan.grid_data as { screenshot_url?: string; notes?: string; scan_type?: string };
    const { error } = await supabase
      .from('heatmap_results')
      .update({
        keyword: editForm.keyword.trim(),
        scan_date: editForm.scan_date,
        average_rank: parseFloat(editForm.average_rank),
        top_rank: parseInt(editForm.top_rank),
        coverage_percentage: parseInt(editForm.coverage_percentage),
        grid_data: { ...gd, notes: editForm.notes.trim() || undefined },
      })
      .eq('id', scan.id);
    if (!error) {
      setEditingId(null);
      load();
    }
    setSaving(false);
  }

  async function handleDelete(scan: HeatmapScan) {
    const gd = scan.grid_data as { screenshot_url?: string; notes?: string; scan_type?: string };
    await supabase.from('heatmap_results').delete().eq('id', scan.id);
    if (gd.screenshot_url) {
      const marker = '/public/rank-tracking/';
      const idx = gd.screenshot_url.indexOf(marker);
      if (idx !== -1) {
        const storagePath = gd.screenshot_url.slice(idx + marker.length);
        await supabase.storage.from('rank-tracking').remove([storagePath]);
      }
    }
    setDeletingId(null);
    setScans(prev => prev.filter(s => s.id !== scan.id));
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
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Scan Type</label>
              <select
                value={scanType}
                onChange={e => setScanType(e.target.value as 'primary' | 'secondary')}
                className={inputCls}
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
                className={inputCls}
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
                className={inputCls}
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
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Coverage % (top 3) <span className="text-red-400">*</span></label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={coverage}
                  onChange={e => {
                    const { value, error } = validateCoverage(e.target.value);
                    setCoverage(value);
                    setCoverageError(error);
                  }}
                  placeholder="e.g. 68"
                  required
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${coverageError ? 'border-red-400 focus:ring-red-400/30' : 'border-gray-200 focus:ring-[#E8622A]/30'}`}
                />
                <span className="text-sm text-gray-500 font-medium select-none">%</span>
              </div>
              {coverageError && <p className="text-xs text-red-500 mt-1">{coverageError}</p>}
              <p className="text-xs text-gray-400 mt-1">Percentage of grid points ranking in top 3</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes…"
                rows={1}
                className={`${inputCls} resize-none`}
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
            disabled={!file || !keyword.trim() || !avgRank || !topRank || !coverage || !!coverageError || uploading}
            className="bg-[#1a2744] text-white px-5 py-2 rounded-lg text-sm hover:bg-[#243460] transition-colors disabled:opacity-40"
          >
            {uploading ? 'Saving…' : 'Save Scan'}
          </button>
        </form>
      </div>

      {/* Section 2 — Benchmark History (card gallery) */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Benchmark History</h3>
        {scans.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No scans uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {scans.map((scan, index) => {
              const trend = getTrend(scan, index);
              const gd = scan.grid_data as { screenshot_url?: string; notes?: string; scan_type?: string };
              const isEditing = editingId === scan.id;
              const isDeleting = deletingId === scan.id;

              if (isEditing) {
                return (
                  <div key={scan.id} className="bg-white border border-blue-300 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Editing scan</p>
                    </div>
                    <div className="p-4 space-y-2.5">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Keyword</label>
                        <input
                          value={editForm.keyword}
                          onChange={e => setEditForm(f => ({ ...f, keyword: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Date</label>
                        <input
                          type="date"
                          value={editForm.scan_date}
                          onChange={e => setEditForm(f => ({ ...f, scan_date: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Avg Rank</label>
                          <input
                            type="number"
                            step="0.1"
                            min="1"
                            value={editForm.average_rank}
                            onChange={e => setEditForm(f => ({ ...f, average_rank: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Top Rank</label>
                          <input
                            type="number"
                            min="1"
                            value={editForm.top_rank}
                            onChange={e => setEditForm(f => ({ ...f, top_rank: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Coverage %</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={editForm.coverage_percentage}
                            onChange={e => {
                              const { value, error } = validateCoverage(e.target.value);
                              setEditForm(f => ({ ...f, coverage_percentage: value }));
                              setEditCoverageError(error);
                            }}
                            className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${editCoverageError ? 'border-red-400 focus:ring-red-400/30' : 'border-gray-200 focus:ring-[#E8622A]/30'}`}
                          />
                          <span className="text-sm text-gray-500 font-medium select-none">%</span>
                        </div>
                        {editCoverageError && <p className="text-xs text-red-500 mt-1">{editCoverageError}</p>}
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                        <textarea
                          value={editForm.notes}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                          rows={2}
                          className={`${inputCls} resize-none`}
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleSave(scan)}
                          disabled={saving || !!editCoverageError}
                          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={scan.id} className="relative group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">

                  {/* Hover action buttons */}
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={() => startEdit(scan)}
                      className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-lg shadow-sm transition-colors"
                      title="Edit scan"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingId(scan.id)}
                      className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg shadow-sm transition-colors"
                      title="Delete scan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Thumbnail */}
                  {gd.screenshot_url ? (
                    <button onClick={() => setLightbox(gd.screenshot_url!)} className="block w-full">
                      <img src={gd.screenshot_url} alt="Heatmap" className="w-full h-32 object-cover" />
                    </button>
                  ) : (
                    <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-300">No screenshot</span>
                    </div>
                  )}

                  {/* Card body */}
                  <div className="p-3 space-y-1.5">
                    <div className="font-medium text-gray-900 text-sm truncate">{scan.keyword}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{format(new Date(scan.scan_date), 'd MMM yyyy')}</span>
                      {gd.scan_type && <span className="text-xs text-gray-400 capitalize">{gd.scan_type}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>Avg: <strong>{scan.average_rank}</strong></span>
                      <span>Top: <strong>#{scan.top_rank}</strong></span>
                      <span className="ml-auto">
                        {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
                        {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                        {trend === 'none' && <Minus className="w-3.5 h-3.5 text-gray-300" />}
                      </span>
                    </div>
                    <div className={`text-xs font-semibold ${scan.coverage_percentage >= 70 ? 'text-green-600' : scan.coverage_percentage >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {scan.coverage_percentage}% coverage
                    </div>
                    {gd.notes && <p className="text-xs text-gray-400 truncate">{gd.notes}</p>}
                  </div>

                  {/* Delete confirmation overlay */}
                  {isDeleting && (
                    <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-4 text-center z-20">
                      <p className="text-sm font-semibold text-gray-900 mb-1">Delete this scan?</p>
                      <p className="text-xs text-gray-400 mb-4">This cannot be undone.</p>
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => setDeletingId(null)}
                          className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(scan)}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

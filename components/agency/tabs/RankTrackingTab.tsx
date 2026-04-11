'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, ZoomIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

interface RankScreenshot {
  id: string;
  category: string;
  date: string;
  notes: string;
  image_url: string;
  created_at: string;
}

export default function RankTrackingTab({ clientId }: { clientId: string }) {
  const [screenshots, setScreenshots] = useState<RankScreenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('primary');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', clientId)
      .like('note', 'RANK_SCREENSHOT:%')
      .order('created_at', { ascending: false });

    const parsed: RankScreenshot[] = (data ?? []).map((n: { id: string; note: string; created_at: string }) => {
      try {
        const payload = JSON.parse(n.note.replace('RANK_SCREENSHOT:', ''));
        return { id: n.id, ...payload, created_at: n.created_at };
      } catch { return null; }
    }).filter(Boolean);

    setScreenshots(parsed);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setMsg('');

    const ext = file.name.split('.').pop();
    const path = `rank-tracking/${clientId}/${Date.now()}.${ext}`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from('client-assets')
      .upload(path, file, { upsert: false });

    if (storageError || !storageData) {
      setMsg(`Upload failed: ${storageError?.message}`);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(path);

    const payload = JSON.stringify({ category, date, notes, image_url: publicUrl });
    await supabase.from('client_notes').insert({
      client_id: clientId,
      note: `RANK_SCREENSHOT:${payload}`,
    });

    setFile(null); setNotes(''); setMsg('Screenshot saved.');
    load();
    setUploading(false);
  }

  async function remove(id: string) {
    await supabase.from('client_notes').delete().eq('id', id);
    load();
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Upload form */}
      <form onSubmit={upload} className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Upload Rank Screenshot</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none">
              <option value="primary">Primary</option>
              <option value="secondary_1">Secondary 1</option>
              <option value="secondary_2">Secondary 2</option>
              <option value="secondary_3">Secondary 3</option>
              <option value="secondary_4">Secondary 4</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. jumped 3 positions" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none" />
          </div>
        </div>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg py-8 px-4 cursor-pointer hover:border-[#E8622A] transition-colors">
          <Upload className="w-6 h-6 text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">{file ? file.name : 'Click or drag screenshot here'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>

        {msg && <p className="text-sm text-[#E8622A]">{msg}</p>}
        <button
          type="submit"
          disabled={!file || uploading}
          className="bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#243460] transition-colors disabled:opacity-40"
        >
          {uploading ? 'Uploading…' : 'Save Screenshot'}
        </button>
      </form>

      {/* Gallery */}
      {screenshots.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No screenshots yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {screenshots.map(s => (
            <div key={s.id} className="group relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <img src={s.image_url} alt={s.category} className="w-full h-32 object-cover" />
              <div className="p-2">
                <p className="text-xs font-medium text-gray-700 capitalize">{s.category.replace('_', ' ')}</p>
                <p className="text-xs text-gray-400">{s.date}</p>
                {s.notes && <p className="text-xs text-gray-500 truncate">{s.notes}</p>}
              </div>
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button onClick={() => setLightbox(s.image_url)} className="w-7 h-7 bg-white rounded shadow flex items-center justify-center">
                  <ZoomIn className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button onClick={() => remove(s.id)} className="w-7 h-7 bg-white rounded shadow flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}

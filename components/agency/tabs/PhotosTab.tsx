'use client';

import { useState, useCallback } from 'react';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

interface PhotoEntry {
  url: string;
  label?: string;
  uploaded_at: string;
}

export default function PhotosTab({ client, onUpdate }: { client: Client; onUpdate?: () => void }) {
  const [photos, setPhotos] = useState<PhotoEntry[]>(() => {
    const wd = client.website_data as Record<string, unknown> ?? {};
    return (wd.photo_gallery as PhotoEntry[]) ?? [];
  });
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [msg, setMsg] = useState('');

  const supabase = createClient();

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMsg('');
    const newPhotos: PhotoEntry[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `client-photos/${client.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('client-photos').upload(path, file, { upsert: false });
      if (error) { setMsg(`Failed to upload ${file.name}: ${error.message}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from('client-photos').getPublicUrl(path);
      newPhotos.push({ url: publicUrl, label: label || undefined, uploaded_at: new Date().toISOString() });
    }

    if (newPhotos.length > 0) {
      const updated = [...photos, ...newPhotos];
      await savePhotos(updated);
      setPhotos(updated);
      setLabel('');
    }
    setUploading(false);
  }

  async function savePhotos(list: PhotoEntry[]) {
    const { data: clientData } = await supabase.from('clients').select('website_data').eq('id', client.id).single();
    const wd = (clientData?.website_data as Record<string, unknown>) ?? {};
    await supabase.from('clients').update({ website_data: { ...wd, photo_gallery: list } }).eq('id', client.id);
    onUpdate?.();
  }

  async function remove(idx: number) {
    const updated = photos.filter((_, i) => i !== idx);
    await savePhotos(updated);
    setPhotos(updated);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }, [photos, label]);

  return (
    <div className="p-6 space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <ImageIcon className="w-4 h-4 inline mr-1.5" />
        AI uses these photos when building the website. Upload high-quality images.
      </div>

      {/* Upload area */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Optional label for these photos…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
          />
        </div>

        <label
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-10 px-6 cursor-pointer transition-colors
            ${dragOver ? 'border-[#E8622A] bg-orange-50' : 'border-gray-300 hover:border-[#E8622A] hover:bg-gray-50'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <Upload className="w-8 h-8 text-gray-300 mb-3" />
          <span className="text-sm font-medium text-gray-600">
            {uploading ? 'Uploading…' : 'Drag & drop or click to upload'}
          </span>
          <span className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — multiple files allowed</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => uploadFiles(e.target.files)}
          />
        </label>

        {msg && <p className="text-sm text-red-500">{msg}</p>}
      </div>

      {/* Gallery */}
      {photos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No photos uploaded yet.</p>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-3">{photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo, i) => (
              <div key={i} className="group relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 aspect-square">
                <img src={photo.url} alt={photo.label ?? `Photo ${i + 1}`} className="w-full h-full object-cover" />
                {photo.label && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                    {photo.label}
                  </div>
                )}
                <button
                  onClick={() => remove(i)}
                  className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

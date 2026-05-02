'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, X, Tag, Loader2, Star, StarOff, Trash2, ZoomIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL ?? '';

const AVAILABLE_TAGS = [
  'GBP Uploaded',
  'Website Hero',
  'Website Gallery',
  'Team',
  'Before/After',
  'Work Sample',
  'Logo',
];

interface ClientPhoto {
  id: string;
  client_id: string;
  storage_path: string;
  public_url: string;
  filename: string;
  tags: string[];
  caption: string | null;
  use_in_next_post: boolean;
  uploaded_at: string;
}

const FILTER_OPTIONS = ['All', ...AVAILABLE_TAGS, 'Unused'];

// ── Photo card ────────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  onUpdate,
  onDelete,
  onEnlarge,
}: {
  photo: ClientPhoto;
  onUpdate: (id: string, patch: Partial<ClientPhoto>) => void;
  onDelete: (id: string) => void;
  onEnlarge: (photo: ClientPhoto) => void;
}) {
  const supabase = createClient();
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [savingCaption, setSavingCaption] = useState(false);
  const [suggestingCaption, setSuggestingCaption] = useState(false);
  const [captionOptions, setCaptionOptions] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  async function saveCaption() {
    if (caption === (photo.caption ?? '')) return;
    setSavingCaption(true);
    await supabase.from('client_photos').update({ caption }).eq('id', photo.id);
    onUpdate(photo.id, { caption });
    setSavingCaption(false);
  }

  async function toggleTag(tag: string) {
    const newTags = photo.tags.includes(tag)
      ? photo.tags.filter(t => t !== tag)
      : [...photo.tags, tag];
    await supabase.from('client_photos').update({ tags: newTags }).eq('id', photo.id);
    onUpdate(photo.id, { tags: newTags });
  }

  async function toggleUseInPost() {
    const next = !photo.use_in_next_post;
    await supabase.from('client_photos').update({ use_in_next_post: next }).eq('id', photo.id);
    onUpdate(photo.id, { use_in_next_post: next });
  }

  async function suggestCaptions() {
    if (!RAILWAY_URL) { setCaptionOptions(['Configure RAILWAY_URL to enable AI captions']); return; }
    setSuggestingCaption(true);
    setCaptionOptions([]);
    try {
      const res = await fetch(`${RAILWAY_URL}/suggest-photo-captions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: photo.id, filename: photo.filename, client_id: photo.client_id }),
      });
      const data = await res.json();
      setCaptionOptions(data.captions ?? ['Could not generate captions — try again.']);
    } catch {
      setCaptionOptions(['Error connecting to backend.']);
    }
    setSuggestingCaption(false);
  }

  async function deletePhoto() {
    if (!confirm(`Delete ${photo.filename}? This cannot be undone.`)) return;
    setDeleting(true);
    await supabase.storage.from('client-files').remove([photo.storage_path]);
    await supabase.from('client_photos').delete().eq('id', photo.id);
    onDelete(photo.id);
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white group">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        <img src={photo.public_url} alt={photo.filename} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        <button
          onClick={() => onEnlarge(photo)}
          className="absolute top-2 left-2 bg-white/80 hover:bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ZoomIn className="w-3.5 h-3.5 text-gray-700" />
        </button>
        <button
          onClick={deletePhoto}
          disabled={deleting}
          className="absolute top-2 right-2 bg-white/80 hover:bg-red-50 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" /> : <Trash2 className="w-3.5 h-3.5 text-red-500" />}
        </button>
        {photo.use_in_next_post && (
          <div className="absolute bottom-2 left-2 bg-amber-400 text-white text-xs px-1.5 py-0.5 rounded font-medium">
            Next post
          </div>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        <p className="text-xs text-gray-500 truncate" title={photo.filename}>{photo.filename}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {AVAILABLE_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                photo.tags.includes(tag)
                  ? 'bg-[#1a2744] text-white border-[#1a2744]'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              <Tag className="w-2.5 h-2.5 mr-0.5" />{tag}
            </button>
          ))}
        </div>

        {/* Caption */}
        <div>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            onBlur={saveCaption}
            rows={2}
            placeholder="Add caption…"
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 resize-none"
          />
          {savingCaption && <p className="text-xs text-gray-400">Saving…</p>}
          {captionOptions.length > 0 && (
            <div className="mt-1 space-y-1">
              {captionOptions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => { setCaption(opt); setCaptionOptions([]); }}
                  className="w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-[#E8622A]/5 border border-gray-200 rounded px-2 py-1.5 transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={suggestCaptions}
            disabled={suggestingCaption}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#E8622A] transition-colors disabled:opacity-50"
          >
            {suggestingCaption && <Loader2 className="w-3 h-3 animate-spin" />}
            Suggest captions
          </button>
          <span className="text-gray-200 text-xs">|</span>
          <button
            onClick={toggleUseInPost}
            className={`flex items-center gap-1 text-xs transition-colors ${
              photo.use_in_next_post ? 'text-amber-600 hover:text-amber-700' : 'text-gray-400 hover:text-amber-600'
            }`}
          >
            {photo.use_in_next_post ? <Star className="w-3 h-3" /> : <StarOff className="w-3 h-3" />}
            {photo.use_in_next_post ? 'Flagged' : 'Use in post'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PhotosTab({ client }: { client: Client; onUpdate?: () => void }) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [photos,    setPhotos]    = useState<ClientPhoto[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter,    setFilter]    = useState('All');
  const [enlarged,  setEnlarged]  = useState<ClientPhoto | null>(null);
  const [uploadErr, setUploadErr] = useState('');

  const loadPhotos = useCallback(async () => {
    const { data } = await supabase
      .from('client_photos')
      .select('*')
      .eq('client_id', client.id)
      .order('uploaded_at', { ascending: false });
    setPhotos((data ?? []) as ClientPhoto[]);
    setLoading(false);
  }, [client.id]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const oversized = files.find(f => f.size > 20 * 1024 * 1024);
    if (oversized) { setUploadErr(`${oversized.name} exceeds 20MB`); return; }

    setUploading(true);
    setUploadErr('');

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `photos/${client.id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from('client-files').upload(path, file);
      if (upErr) { setUploadErr(`Failed: ${file.name} — ${upErr.message}`); continue; }
      const { data: urlData } = supabase.storage.from('client-files').getPublicUrl(path);
      await supabase.from('client_photos').insert({
        client_id: client.id, storage_path: path, public_url: urlData.publicUrl,
        filename: file.name, tags: [], caption: null, use_in_next_post: false,
      });
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    loadPhotos();
  }

  function updatePhoto(id: string, patch: Partial<ClientPhoto>) {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  function deletePhoto(id: string) {
    setPhotos(prev => prev.filter(p => p.id !== id));
  }

  const filtered = photos.filter(p => {
    if (filter === 'All') return true;
    if (filter === 'Unused') return p.tags.length === 0;
    return p.tags.includes(filter);
  });

  return (
    <div className="p-6 space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap flex-1">
          {FILTER_OPTIONS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f ? 'bg-[#1a2744] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f}
              {f === 'All' && photos.length > 0 && ` (${photos.length})`}
              {f !== 'All' && f !== 'Unused' && photos.filter(p => p.tags.includes(f)).length > 0 && ` (${photos.filter(p => p.tags.includes(f)).length})`}
              {f === 'Unused' && photos.filter(p => p.tags.length === 0).length > 0 && ` (${photos.filter(p => p.tags.length === 0).length})`}
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-[#E8622A] text-white text-sm font-medium rounded-lg hover:bg-[#d05520] transition-colors disabled:opacity-50 shrink-0"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload photos'}
        </button>
      </div>

      {uploadErr && <p className="text-sm text-red-600">{uploadErr}</p>}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {photos.length === 0 ? 'No photos yet. Upload some above.' : `No photos match "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(photo => (
            <PhotoCard key={photo.id} photo={photo} onUpdate={updatePhoto} onDelete={deletePhoto} onEnlarge={setEnlarged} />
          ))}
        </div>
      )}

      {/* Enlarge modal */}
      {enlarged && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setEnlarged(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <img src={enlarged.public_url} alt={enlarged.filename} className="w-full max-h-[85vh] object-contain rounded-xl" />
            <button onClick={() => setEnlarged(null)} className="absolute top-3 right-3 bg-white/80 hover:bg-white rounded-full p-1.5">
              <X className="w-5 h-5 text-gray-700" />
            </button>
            {enlarged.caption && <p className="mt-2 text-center text-sm text-white/80">{enlarged.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

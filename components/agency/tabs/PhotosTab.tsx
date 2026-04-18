'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

interface PhotoEntry {
  url: string;
  label?: string;
  uploaded_at: string;
}

export default function PhotosTab({ client, onUpdate }: { client: Client; onUpdate?: () => void }) {
  const clientId = client.id;
  const supabase = createClient();

  // ── Logo state ──────────────────────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState<string | null>(client.logo_url ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState('');

  // ── Photo gallery state ──────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Load photos from clients.photos on mount ─────────────────────────────────
  useEffect(() => {
    async function loadPhotos() {
      const { data } = await supabase
        .from('clients')
        .select('photos, logo_url')
        .eq('id', clientId)
        .single();

      if (data?.photos && Array.isArray(data.photos)) {
        setPhotos(data.photos);
      }
      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
    }
    loadPhotos();
  }, [clientId]);

  // ── Logo upload / remove ─────────────────────────────────────────────────────
  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    setLogoMsg('');
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `client-photos/${clientId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('client-photos')
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setLogoMsg(`Upload failed: ${uploadError.message}`);
      setUploadingLogo(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('client-photos').getPublicUrl(path);
    await supabase.from('clients').update({ logo_url: urlData.publicUrl }).eq('id', clientId);
    setLogoUrl(urlData.publicUrl);
    setLogoMsg('Logo saved.');
    onUpdate?.();
    setUploadingLogo(false);
  }

  async function removeLogo() {
    await supabase.from('clients').update({ logo_url: null }).eq('id', clientId);
    setLogoUrl(null);
    onUpdate?.();
  }

  // ── Photo upload ─────────────────────────────────────────────────────────────
  async function uploadPhoto(file: File, photoLabel: string) {
    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `client-photos/${clientId}/${filename}`;

    // 1. Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('client-photos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      setError(`Upload failed: ${uploadError.message}`);
      return;
    }

    // 2. Get public URL
    const { data: urlData } = supabase.storage
      .from('client-photos')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // 3. Save to clients.photos array
    const newPhoto: PhotoEntry = {
      url: publicUrl,
      label: photoLabel || '',
      uploaded_at: new Date().toISOString(),
    };

    const currentPhotos = Array.isArray(photos) ? photos : [];
    const updatedPhotos = [...currentPhotos, newPhoto];

    const { error: dbError } = await supabase
      .from('clients')
      .update({ photos: updatedPhotos })
      .eq('id', clientId);

    if (dbError) {
      console.error('DB save error:', dbError);
      setError(`Failed to save photo: ${dbError.message}`);
      return;
    }

    // 4. Update local state immediately
    setPhotos(updatedPhotos);
    setSuccess('Photo uploaded successfully');
    onUpdate?.();
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    setSuccess('');

    for (const file of Array.from(files)) {
      await uploadPhoto(file, label);
    }

    setLabel('');
    setUploading(false);
  }

  // ── Photo delete ─────────────────────────────────────────────────────────────
  async function removePhoto(idx: number) {
    const photo = photos[idx];

    // Derive storage path from the public URL
    const storagePath = photo.url.split('/client-photos/')[1];
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('client-photos')
        .remove([storagePath]);
      if (storageError) {
        console.error('Storage delete error:', storageError);
      }
    }

    const updatedPhotos = photos.filter((_, i) => i !== idx);

    const { error: dbError } = await supabase
      .from('clients')
      .update({ photos: updatedPhotos })
      .eq('id', clientId);

    if (dbError) {
      console.error('DB delete error:', dbError);
      setError(`Failed to remove photo: ${dbError.message}`);
      return;
    }

    setPhotos(updatedPhotos);
    onUpdate?.();
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      uploadFiles(e.dataTransfer.files);
    },
    [photos, label],
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Business Logo */}
      <div className="border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm">Business Logo</h3>
        {logoUrl ? (
          <div className="flex items-center gap-4">
            <div className="w-32 h-16 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
              <img src={logoUrl} alt="Business logo" className="max-w-full max-h-full object-contain" loading="lazy" />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[#E8622A] cursor-pointer hover:text-[#d05520]">
                <Upload className="w-4 h-4" />
                Replace logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]); }}
                />
              </label>
              <button
                onClick={removeLogo}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
                Remove logo
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-8 px-4 cursor-pointer hover:border-[#E8622A] transition-colors">
            <Upload className="w-6 h-6 text-gray-300 mb-2" />
            <span className="text-sm font-medium text-gray-500">
              {uploadingLogo ? 'Uploading…' : 'Upload business logo'}
            </span>
            <span className="text-xs text-gray-400 mt-1">PNG, JPG, SVG</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]); }}
            />
          </label>
        )}
        {logoMsg && (
          <p className={`text-xs ${logoMsg.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>
            {logoMsg}
          </p>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <ImageIcon className="w-4 h-4 inline mr-1.5" />
        AI uses these photos when building the website. Upload high-quality images.
      </div>

      {/* Upload area */}
      <div className="space-y-3">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Optional label for these photos…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
        />

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

        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
      </div>

      {/* Gallery */}
      {photos.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">No photos uploaded yet. Use the uploader above to add photos.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo, i) => (
              <div
                key={photo.url}
                className="group relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 aspect-square"
              >
                <img
                  src={photo.url}
                  alt={photo.label || `Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {photo.label && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                    {photo.label}
                  </div>
                )}
                <button
                  onClick={() => removePhoto(i)}
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
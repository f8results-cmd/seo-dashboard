'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Trash2, Image as ImageIcon, Star, FolderOpen, Pencil, ExternalLink, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PhotoEntry {
  url: string;
  label?: string;
  uploaded_at: string;
  photo_number?: number;
}

const PHOTO_LABELS = [
  { value: 'cover',     label: 'Cover / Hero' },
  { value: 'van',       label: 'Company Van' },
  { value: 'team',      label: 'Team Photo' },
  { value: 'exterior',  label: 'Exterior' },
  { value: 'interior',  label: 'Interior' },
  { value: 'before',    label: 'Before (Job)' },
  { value: 'after',     label: 'After (Job)' },
  { value: 'job',       label: 'Job / Work in Progress' },
  { value: 'equipment', label: 'Equipment / Tools' },
  { value: 'other',     label: 'Other' },
];

// ── Main component ───────────────────────────────────────────────────────────

export default function PhotosTab({ client, onUpdate }: { client: Client; onUpdate?: () => void }) {
  const clientId = client.id;
  const supabase = createClient();

  // ── Drive folder state ──────────────────────────────────────────────────────
  const [driveUrl, setDriveUrl] = useState<string | null>(client.photo_drive_url ?? null);
  const [driveInput, setDriveInput] = useState('');
  const [driveEditing, setDriveEditing] = useState(false);
  const [driveSaving, setDriveSaving] = useState(false);

  async function saveDriveUrl(url: string) {
    setDriveSaving(true);
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_drive_url: url || null }),
    });
    setDriveUrl(url || null);
    setDriveEditing(false);
    setDriveInput('');
    setDriveSaving(false);
    onUpdate?.();
  }

  // ── Logo state ──────────────────────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState<string | null>(client.logo_url ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState('');

  // ── Gallery state ───────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [globalError, setGlobalError] = useState('');

  // ── Load photos on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadPhotos() {
      const { data } = await supabase
        .from('clients')
        .select('photos, logo_url, website_data')
        .eq('id', clientId)
        .single();

      if (data?.photos && Array.isArray(data.photos)) setPhotos(data.photos);
      if (data?.logo_url) setLogoUrl(data.logo_url);
      const wd = data?.website_data as Record<string, unknown> | null;
      if (wd?.cover_photo) setCoverPhotoUrl(wd.cover_photo as string);
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
    if (uploadError) { setLogoMsg(`Upload failed: ${uploadError.message}`); setUploadingLogo(false); return; }
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

  // ── Upload file to Supabase Storage with sequential numbering ───────────────
  async function uploadFileToStorage(file: File, photoNum: number): Promise<string> {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const filename = `photo-${photoNum}.${ext}`;
    const path = `client-photos/${clientId}/${filename}`;
    const { error } = await supabase.storage.from('client-photos').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data: urlData } = supabase.storage.from('client-photos').getPublicUrl(path);
    return urlData.publicUrl;
  }

  // ── Handle file drop / selection — upload and save immediately ──────────────
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setGlobalError('');
    setUploading(true);

    const fileArray = Array.from(files).slice(0, 20);
    const startNum = photos.length + 1;

    const newPhotos: PhotoEntry[] = [];
    let done = 0;

    await Promise.all(
      fileArray.map(async (file, i) => {
        const photoNum = startNum + i;
        try {
          setUploadProgress(`Uploading photo ${photoNum}…`);
          const url = await uploadFileToStorage(file, photoNum);
          newPhotos.push({
            url,
            label: 'job',
            uploaded_at: new Date().toISOString(),
            photo_number: photoNum,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed';
          setGlobalError(`Photo ${photoNum} failed: ${msg}`);
        } finally {
          done++;
          setUploadProgress(`Uploaded ${done} of ${fileArray.length}…`);
        }
      })
    );

    if (newPhotos.length > 0) {
      // Sort by photo_number so they're in order
      newPhotos.sort((a, b) => (a.photo_number ?? 0) - (b.photo_number ?? 0));
      const currentPhotos = Array.isArray(photos) ? photos : [];
      const updatedPhotos = [...currentPhotos, ...newPhotos];
      const { error } = await supabase.from('clients').update({ photos: updatedPhotos }).eq('id', clientId);
      if (error) {
        setGlobalError(`Failed to save: ${error.message}`);
      } else {
        setPhotos(updatedPhotos);
        onUpdate?.();
      }
    }

    setUploading(false);
    setUploadProgress('');
  }

  // ── Set cover photo ───────────────────────────────────────────────────────────
  async function setCoverPhoto(url: string) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('website_data')
      .eq('id', clientId)
      .single();
    const wd = (clientData?.website_data as Record<string, unknown> | null) ?? {};
    const updated = { ...wd, cover_photo: url };
    await supabase.from('clients').update({ website_data: updated }).eq('id', clientId);
    setCoverPhotoUrl(url);
    onUpdate?.();
  }

  // ── Update label on existing gallery photo ────────────────────────────────────
  async function updatePhotoLabel(idx: number, newLabel: string) {
    const updatedPhotos = photos.map((p, i) => i === idx ? { ...p, label: newLabel } : p);
    await supabase.from('clients').update({ photos: updatedPhotos }).eq('id', clientId);
    setPhotos(updatedPhotos);
    onUpdate?.();
  }

  // ── Delete gallery photo ──────────────────────────────────────────────────────
  async function removePhoto(idx: number) {
    const photo = photos[idx];
    const storagePath = photo.url.split('/client-photos/')[1];
    if (storagePath) await supabase.storage.from('client-photos').remove([storagePath]);
    const updatedPhotos = photos.filter((_, i) => i !== idx);
    const { error } = await supabase.from('clients').update({ photos: updatedPhotos }).eq('id', clientId);
    if (error) { setGlobalError(`Failed to remove: ${error.message}`); return; }
    setPhotos(updatedPhotos);
    onUpdate?.();
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [photos],
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Client Photo Drive */}
      <div className="border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[#E8622A]" />
          Client Photo Drive
        </h3>
        {driveUrl && !driveEditing ? (
          <div className="flex items-center gap-3">
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#E8622A] hover:bg-[#d05520] rounded-lg px-4 py-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Drive Folder
            </a>
            <button
              onClick={() => { setDriveInput(driveUrl); setDriveEditing(true); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              title="Edit URL"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={driveEditing ? driveInput : driveInput}
              onChange={e => setDriveInput(e.target.value)}
              placeholder="Paste Google Drive folder URL"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
            />
            <button
              onClick={() => saveDriveUrl(driveInput.trim())}
              disabled={!driveInput.trim() || driveSaving}
              className="text-sm font-medium text-white bg-[#E8622A] hover:bg-[#d05520] rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {driveSaving ? 'Saving…' : 'Save'}
            </button>
            {driveEditing && (
              <button
                onClick={() => { setDriveEditing(false); setDriveInput(''); }}
                className="text-sm text-gray-400 hover:text-gray-600 px-2 py-2"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

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
                <Upload className="w-4 h-4" /> Replace logo
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]); }} />
              </label>
              <button onClick={removeLogo} className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" /> Remove logo
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-8 px-4 cursor-pointer hover:border-[#E8622A] transition-colors">
            <Upload className="w-6 h-6 text-gray-300 mb-2" />
            <span className="text-sm font-medium text-gray-500">
              {uploadingLogo ? 'Uploading…' : 'Upload business logo'}
            </span>
            <span className="text-xs text-gray-400 mt-1">PNG, JPG, SVG, WEBP</span>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
              onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]); }} />
          </label>
        )}
        {logoMsg && (
          <p className={`text-xs ${logoMsg.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>{logoMsg}</p>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
        <ImageIcon className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Photos are saved instantly with sequential numbers (Photo 1, Photo 2…) so you can
          reference them by number in chat. Set the best shot as the <strong>cover photo</strong>.
        </span>
      </div>

      {globalError && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {globalError}
        </p>
      )}

      {/* Upload area */}
      <label
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-10 px-6 cursor-pointer transition-colors
          ${uploading ? 'border-[#E8622A] bg-orange-50 cursor-not-allowed' :
            dragOver ? 'border-[#E8622A] bg-orange-50' :
            'border-gray-300 hover:border-[#E8622A] hover:bg-gray-50'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <Upload className={`w-8 h-8 mb-3 ${uploading ? 'text-[#E8622A] animate-pulse' : 'text-gray-300'}`} />
        <span className="text-sm font-medium text-gray-600">
          {uploading ? uploadProgress || 'Uploading…' : 'Drag & drop or click to upload'}
        </span>
        <span className="text-xs text-gray-400 mt-1">
          {uploading ? `Next photo will be #${photos.length + 1}` : `JPG, PNG, WEBP — up to 20 at once · Next: Photo ${photos.length + 1}`}
        </span>
        <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
          onChange={e => handleFiles(e.target.files)} />
      </label>

      {/* Gallery */}
      {photos.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">No photos uploaded yet. Drag and drop images above.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">{photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
            {coverPhotoUrl && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-current" /> Cover photo set
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo, i) => {
              const isCover = photo.url === coverPhotoUrl;
              const displayNum = photo.photo_number ?? i + 1;
              return (
                <div
                  key={photo.url}
                  className={`group relative border rounded-xl overflow-hidden bg-gray-50 aspect-square
                    ${isCover ? 'border-yellow-400 ring-2 ring-yellow-400/40' : 'border-gray-200'}`}
                >
                  <img src={photo.url} alt={photo.label || `Photo ${displayNum}`}
                    className="w-full h-full object-cover" loading="lazy" />

                  {/* Photo number badge — always visible */}
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center leading-none">
                    {displayNum}
                  </div>

                  {/* Cover star badge */}
                  {isCover && (
                    <div className="absolute top-2 right-2 bg-yellow-400 rounded-full p-1">
                      <Star className="w-3 h-3 text-white fill-white" />
                    </div>
                  )}

                  {/* Controls on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all">
                    <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform space-y-1.5">
                      <select
                        value={photo.label || ''}
                        onChange={e => updatePhotoLabel(i, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-xs border-0 rounded-md px-2 py-1 bg-white/90 focus:outline-none focus:ring-1 focus:ring-[#E8622A]"
                      >
                        <option value="">No label</option>
                        {PHOTO_LABELS.map(l => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        {!isCover && (
                          <button
                            onClick={() => setCoverPhoto(photo.url)}
                            className="flex-1 text-xs bg-yellow-400 text-white rounded-md py-1 hover:bg-yellow-500 font-medium"
                          >
                            Set cover
                          </button>
                        )}
                        <button
                          onClick={() => removePhoto(i)}
                          className="flex-1 text-xs bg-red-500 text-white rounded-md py-1 hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Label badge */}
                  {photo.label && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate group-hover:opacity-0 transition-opacity">
                      {photo.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Trash2, Image as ImageIcon, Sparkles, Star, Check, X, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PhotoEntry {
  url: string;
  label?: string;
  uploaded_at: string;
}

interface AnalysisResult {
  index: number;
  url: string;
  suggested_label: string;
  is_hero_candidate: boolean;
  quality_score: number;
  description: string;
  error?: string;
}

// Pending items waiting for label confirmation before being saved to DB
interface PendingPhoto {
  file: File;
  url: string;          // public URL after upload
  analysisResult?: AnalysisResult;
  chosenLabel: string;
  uploading: boolean;
  analysing: boolean;
  uploadError?: string;
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

const QUALITY_STARS = [1, 2, 3, 4, 5];

function QualityBadge({ score }: { score: number }) {
  const colour =
    score >= 4 ? 'text-green-600' :
    score >= 3 ? 'text-yellow-500' :
    'text-red-400';
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${colour}`}>
      {QUALITY_STARS.map(n => (
        <Star key={n} className={`w-3 h-3 ${n <= score ? 'fill-current' : 'opacity-30'}`} />
      ))}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PhotosTab({ client, onUpdate }: { client: Client; onUpdate?: () => void }) {
  const clientId = client.id;
  const supabase = createClient();

  // ── Logo state ──────────────────────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState<string | null>(client.logo_url ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState('');

  // ── Gallery state ───────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // ── Pending uploads (uploaded but awaiting AI review + label confirm) ────────
  const [pending, setPending] = useState<PendingPhoto[]>([]);

  const pendingRef = useRef(pending);
  pendingRef.current = pending;

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

  // ── Upload file to Supabase Storage, returns public URL ─────────────────────
  async function uploadFileToStorage(file: File): Promise<string> {
    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `client-photos/${clientId}/${filename}`;
    const { error } = await supabase.storage.from('client-photos').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data: urlData } = supabase.storage.from('client-photos').getPublicUrl(path);
    return urlData.publicUrl;
  }

  // ── Run AI analysis on a list of uploaded photos ─────────────────────────────
  async function analysePhotos(items: { url: string; index: number }[]) {
    if (items.length === 0) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/photos/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: items }),
      });
      if (!res.ok) return;
      const { results } = await res.json() as { results: AnalysisResult[] };

      setPending(prev => prev.map(p => {
        const r = results.find(r => r.url === p.url);
        if (!r) return p;
        return {
          ...p,
          analysing: false,
          analysisResult: r,
          chosenLabel: r.suggested_label || p.chosenLabel,
        };
      }));
    } catch {
      // On analysis error, just clear analysing state — user can still pick a label manually
      setPending(prev => prev.map(p => ({ ...p, analysing: false })));
    }
  }

  // ── Handle file drop / selection — upload then analyse ──────────────────────
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setGlobalError('');
    const fileArray = Array.from(files).slice(0, 20);

    // 1. Create pending entries immediately so UI shows progress
    const newPendingBase: PendingPhoto[] = fileArray.map(f => ({
      file: f,
      url: '',
      chosenLabel: '',
      uploading: true,
      analysing: false,
    }));

    const startIndex = pendingRef.current.length;
    setPending(prev => [...prev, ...newPendingBase]);

    // 2. Upload files in parallel
    const uploaded: { url: string; pendingIdx: number }[] = [];
    await Promise.all(
      fileArray.map(async (file, i) => {
        const pendingIdx = startIndex + i;
        try {
          const url = await uploadFileToStorage(file);
          uploaded.push({ url, pendingIdx });
          setPending(prev => prev.map((p, pi) =>
            pi === pendingIdx ? { ...p, url, uploading: false, analysing: true } : p
          ));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed';
          setPending(prev => prev.map((p, pi) =>
            pi === pendingIdx ? { ...p, uploading: false, uploadError: msg } : p
          ));
        }
      })
    );

    if (uploaded.length === 0) return;

    // 3. Run AI analysis in one batch call
    await analysePhotos(uploaded.map(({ url, pendingIdx }) => ({ url, index: pendingIdx })));
  }

  // ── Confirm a pending photo: save to DB with chosen label ───────────────────
  async function confirmPhoto(pendingIdx: number) {
    const item = pending[pendingIdx];
    if (!item || !item.url) return;

    const newPhoto: PhotoEntry = {
      url: item.url,
      label: item.chosenLabel || '',
      uploaded_at: new Date().toISOString(),
    };

    const currentPhotos = Array.isArray(photos) ? photos : [];
    const updatedPhotos = [...currentPhotos, newPhoto];

    const { error } = await supabase.from('clients').update({ photos: updatedPhotos }).eq('id', clientId);
    if (error) { setGlobalError(`Failed to save: ${error.message}`); return; }

    setPhotos(updatedPhotos);
    setPending(prev => prev.filter((_, i) => i !== pendingIdx));
    onUpdate?.();
  }

  // ── Dismiss (discard) a pending photo ────────────────────────────────────────
  function dismissPending(pendingIdx: number) {
    const item = pending[pendingIdx];
    if (item?.url) {
      const storagePath = item.url.split('/client-photos/')[1];
      if (storagePath) supabase.storage.from('client-photos').remove([storagePath]);
    }
    setPending(prev => prev.filter((_, i) => i !== pendingIdx));
  }

  // ── Confirm all pending at once ───────────────────────────────────────────────
  async function confirmAllPending() {
    const readyItems = pending.filter(p => p.url && !p.uploading && !p.analysing);
    if (readyItems.length === 0) return;

    const newPhotos: PhotoEntry[] = readyItems.map(p => ({
      url: p.url,
      label: p.chosenLabel || '',
      uploaded_at: new Date().toISOString(),
    }));

    const currentPhotos = Array.isArray(photos) ? photos : [];
    const updatedPhotos = [...currentPhotos, ...newPhotos];

    const { error } = await supabase.from('clients').update({ photos: updatedPhotos }).eq('id', clientId);
    if (error) { setGlobalError(`Failed to save: ${error.message}`); return; }

    setPhotos(updatedPhotos);
    // Remove confirmed items, keep any still uploading/analysing
    setPending(prev => prev.filter(p => !p.url || p.uploading || p.analysing));
    onUpdate?.();
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

  const readyPending = pending.filter(p => p.url && !p.uploading && !p.analysing);
  const activePending = pending.filter(p => p.uploading || p.analysing);

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
                <Upload className="w-4 h-4" /> Replace logo
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
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
            <span className="text-xs text-gray-400 mt-1">PNG, JPG, SVG</span>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
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
          AI uses these photos when building the website. Upload high-quality images — AI will
          suggest labels automatically. Set the best shot as the <strong>cover photo</strong>.
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
          ${dragOver ? 'border-[#E8622A] bg-orange-50' : 'border-gray-300 hover:border-[#E8622A] hover:bg-gray-50'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <Upload className="w-8 h-8 text-gray-300 mb-3" />
        <span className="text-sm font-medium text-gray-600">Drag & drop or click to upload</span>
        <span className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — up to 20 files at once</span>
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />
      </label>

      {/* Pending uploads — in-progress */}
      {activePending.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Uploading & Analysing…</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {activePending.map((item, i) => (
              <div key={i} className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 aspect-square flex items-center justify-center">
                {item.url ? (
                  <img src={item.url} alt="" className="w-full h-full object-cover opacity-50" />
                ) : (
                  <Upload className="w-6 h-6 text-gray-300 animate-pulse" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <div className="text-center">
                    <Sparkles className="w-5 h-5 text-[#E8622A] mx-auto animate-pulse" />
                    <p className="text-xs text-gray-500 mt-1">
                      {item.uploading ? 'Uploading…' : 'Analysing…'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending uploads — ready for review */}
      {readyPending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#E8622A]" />
              AI Analysis — Review & Confirm
            </h4>
            <button
              onClick={confirmAllPending}
              className="text-xs font-medium text-[#E8622A] hover:underline"
            >
              Confirm all ({readyPending.length})
            </button>
          </div>

          <div className="space-y-3">
            {pending.map((item, idx) => {
              if (!item.url || item.uploading || item.analysing) return null;
              const res = item.analysisResult;
              return (
                <div key={item.url} className="flex gap-3 border border-gray-200 rounded-xl p-3 bg-white">
                  <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    {res?.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{res.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {res?.is_hero_candidate && (
                        <span className="inline-flex items-center gap-1 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-2 py-0.5 font-medium">
                          <Star className="w-3 h-3 fill-current" /> Hero candidate
                        </span>
                      )}
                      {res?.quality_score && <QualityBadge score={res.quality_score} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <select
                          value={item.chosenLabel}
                          onChange={e => setPending(prev => prev.map((p, i) =>
                            i === idx ? { ...p, chosenLabel: e.target.value } : p
                          ))}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 pr-6 bg-white focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30 appearance-none"
                        >
                          <option value="">Pick label…</option>
                          {PHOTO_LABELS.map(l => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => confirmPhoto(idx)}
                      disabled={!item.chosenLabel}
                      className="flex items-center gap-1 text-xs font-medium text-white bg-[#E8622A] rounded-lg px-3 py-1.5 hover:bg-[#d05520] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button
                      onClick={() => dismissPending(idx)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50"
                    >
                      <X className="w-3 h-3" /> Discard
                    </button>
                    {res?.is_hero_candidate && (
                      <button
                        onClick={async () => { await setCoverPhoto(item.url); await confirmPhoto(idx); }}
                        disabled={!item.url}
                        className="flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 hover:bg-yellow-100"
                      >
                        <Star className="w-3 h-3 fill-current" /> Set cover
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gallery */}
      {photos.length === 0 && pending.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">No photos uploaded yet. Drag and drop images above.</p>
        </div>
      ) : photos.length > 0 ? (
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
              return (
                <div
                  key={photo.url}
                  className={`group relative border rounded-xl overflow-hidden bg-gray-50 aspect-square
                    ${isCover ? 'border-yellow-400 ring-2 ring-yellow-400/40' : 'border-gray-200'}`}
                >
                  <img src={photo.url} alt={photo.label || `Photo ${i + 1}`}
                    className="w-full h-full object-cover" loading="lazy" />

                  {/* Cover star badge */}
                  {isCover && (
                    <div className="absolute top-2 left-2 bg-yellow-400 rounded-full p-1">
                      <Star className="w-3 h-3 text-white fill-white" />
                    </div>
                  )}

                  {/* Label / cover controls — on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all">
                    <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform space-y-1.5">
                      {/* Label selector */}
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
                      {/* Set cover / delete */}
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

                  {/* Label badge (not on hover) */}
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
      ) : null}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Client, ClientPhotos } from '@/lib/types';

// ─── Slot config ──────────────────────────────────────────────────────────────

type PhotoKey = keyof ClientPhotos;

const PHOTO_SLOTS: {
  key: PhotoKey;
  label: string;
  hint: string;
  aspect: string;
}[] = [
  { key: 'logo',     label: 'Logo',                          hint: 'Square, min 250×250px',              aspect: '1 / 1' },
  { key: 'cover',    label: 'Cover Photo',                   hint: '1080×608px',                         aspect: '1080 / 608' },
  { key: 'exterior', label: 'Exterior / Vehicle / Equipment',hint: 'Landscape recommended',              aspect: '4 / 3' },
  { key: 'owner',    label: 'Owner / Team Photo',            hint: 'Headshot or team shot',              aspect: '4 / 3' },
  { key: 'work1',    label: 'Work in Progress (1)',          hint: 'Job site or service in action',      aspect: '4 / 3' },
  { key: 'work2',    label: 'Work in Progress (2)',          hint: 'Job site or service in action',      aspect: '4 / 3' },
  { key: 'before',   label: 'Before Photo',                  hint: 'Before transformation',              aspect: '4 / 3' },
  { key: 'after',    label: 'After Photo',                   hint: 'After transformation',               aspect: '4 / 3' },
  { key: 'extra1',   label: 'Extra (1)',                     hint: 'Additional business photo',          aspect: '4 / 3' },
  { key: 'extra2',   label: 'Extra (2)',                     hint: 'Additional business photo',          aspect: '4 / 3' },
];

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  client: Client;
}

export default function PhotosTab({ client }: Props) {
  const [photos, setPhotos] = useState<Partial<ClientPhotos>>(
    (client.photos ?? {}) as Partial<ClientPhotos>
  );
  const [uploading, setUploading] = useState<Partial<Record<PhotoKey, boolean>>>({});
  const [errors,    setErrors]    = useState<Partial<Record<PhotoKey, string>>>({});

  async function handleUpload(key: PhotoKey, file: File) {
    setUploading((p) => ({ ...p, [key]: true }));
    setErrors((p)    => ({ ...p, [key]: '' }));
    try {
      const supabase = createClient();
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${client.id}/${key}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('client-photos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('client-photos')
        .getPublicUrl(path);

      const next = { ...photos, [key]: publicUrl };
      const res  = await fetch(`/api/clients/${client.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ photos: next }),
      });
      if (!res.ok) throw new Error('Failed to save photo URL');
      setPhotos(next);
    } catch (err) {
      setErrors((p) => ({ ...p, [key]: (err as Error).message ?? 'Upload failed' }));
    } finally {
      setUploading((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleDelete(key: PhotoKey) {
    const url = photos[key];
    if (!url) return;
    setUploading((p) => ({ ...p, [key]: true }));
    setErrors((p)    => ({ ...p, [key]: '' }));
    try {
      const supabase = createClient();
      // Path is the last two URL segments: {client_id}/{key}.{ext}
      const segments    = new URL(url).pathname.split('/');
      const storagePath = segments.slice(-2).join('/');
      await supabase.storage.from('client-photos').remove([storagePath]);

      const next = { ...photos, [key]: null };
      const res  = await fetch(`/api/clients/${client.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ photos: next }),
      });
      if (!res.ok) throw new Error('Failed to update record');
      setPhotos(next);
    } catch (err) {
      setErrors((p) => ({ ...p, [key]: (err as Error).message ?? 'Delete failed' }));
    } finally {
      setUploading((p) => ({ ...p, [key]: false }));
    }
  }

  const uploaded = Object.values(photos).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="font-semibold text-gray-900">Client Photos</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Stored in Supabase · used for GBP, website &amp; reporting
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
            {uploaded} / {PHOTO_SLOTS.length} uploaded
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
          {PHOTO_SLOTS.map((slot) => (
            <PhotoSlot
              key={slot.key}
              slot={slot}
              url={photos[slot.key] ?? null}
              uploading={!!uploading[slot.key]}
              error={errors[slot.key] ?? ''}
              onUpload={(file) => handleUpload(slot.key, file)}
              onDelete={() => handleDelete(slot.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Individual slot ──────────────────────────────────────────────────────────

function PhotoSlot({
  slot,
  url,
  uploading,
  error,
  onUpload,
  onDelete,
}: {
  slot: (typeof PHOTO_SLOTS)[number];
  url: string | null;
  uploading: boolean;
  error: string;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = ''; // allow re-selecting same file
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row */}
      <p className="text-xs font-semibold text-gray-700 leading-tight">{slot.label}</p>
      <p className="text-xs text-gray-400 -mt-0.5 leading-tight">{slot.hint}</p>

      {/* Photo area */}
      <div
        className="relative group rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 transition-colors hover:border-gray-300"
        style={{ aspectRatio: slot.aspect }}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={slot.label}
              className="w-full h-full object-cover"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
              {uploading ? (
                <Spinner />
              ) : (
                <>
                  <label className="cursor-pointer text-white text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg px-2.5 py-1.5 transition-colors">
                    Replace
                    <input type="file" accept="image/*" className="hidden" onChange={onChange} />
                  </label>
                  <button
                    onClick={onDelete}
                    className="text-white text-xs font-medium bg-red-500/80 hover:bg-red-600 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <label className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer p-3">
            {uploading ? (
              <Spinner />
            ) : (
              <>
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-xs text-gray-400 text-center leading-tight">
                  Click to upload
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onChange}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {error && <p className="text-xs text-red-500 leading-tight">{error}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-gray-300 border-t-[#1B2B6B] rounded-full animate-spin" />
  );
}

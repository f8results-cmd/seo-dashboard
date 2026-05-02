-- Migration 025: client_photos — per-client photo library with tags and captions
-- Run in Supabase SQL Editor. Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS client_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  public_url      TEXT NOT NULL,
  filename        TEXT NOT NULL,
  tags            TEXT[] DEFAULT '{}',
  caption         TEXT,
  use_in_next_post BOOLEAN DEFAULT FALSE,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_photos_client_id ON client_photos(client_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_uploaded ON client_photos(uploaded_at DESC);

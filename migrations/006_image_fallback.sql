-- Migration 006: image fallback columns
-- Run in Supabase SQL editor

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS use_fallback_images  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS photos_source        text,       -- 'uploaded' | 'ai_generated' | 'stock' | 'mixed'
  ADD COLUMN IF NOT EXISTS we_host_website      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hosting_platform     text,
  ADD COLUMN IF NOT EXISTS hosting_cost_monthly numeric,
  ADD COLUMN IF NOT EXISTS hosting_included_in_plan boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_hosting_location text;

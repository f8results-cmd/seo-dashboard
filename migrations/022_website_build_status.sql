-- Migration 022: Add website_build_status to clients
-- Tracks the website progress stage independent of live_url.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website_build_status TEXT
  CHECK (website_build_status IN ('to_be_built', 'being_built', 'being_reviewed', 'live'));

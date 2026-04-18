-- Migration 012: Add GBP primary/secondary category columns to clients
-- These are written by CategoryResearchAgent and displayed in GBPSetupTab.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gbp_primary_category   TEXT,
  ADD COLUMN IF NOT EXISTS gbp_secondary_categories TEXT[];

COMMENT ON COLUMN clients.gbp_primary_category IS
  'Validated primary GBP category, written by CategoryResearchAgent.';

COMMENT ON COLUMN clients.gbp_secondary_categories IS
  'Validated secondary GBP categories (array), written by CategoryResearchAgent.';

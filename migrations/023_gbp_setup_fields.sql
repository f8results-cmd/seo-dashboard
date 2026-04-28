-- Migration 023: GBP Setup manual-entry fields
-- Adds manual_services, target_suburbs, and competitor_research_files
-- to support the manual-first GBP setup tab.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS manual_services TEXT,
  ADD COLUMN IF NOT EXISTS target_suburbs JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS competitor_research_files JSONB DEFAULT '[]'::jsonb;

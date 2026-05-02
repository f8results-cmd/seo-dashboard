-- Migration 026: citation_opportunities — per-client citation tracking
-- Run in Supabase SQL Editor. Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS citation_opportunities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID REFERENCES clients(id) ON DELETE CASCADE,
  directory_name   TEXT NOT NULL,
  directory_url    TEXT,
  domain_authority INT,
  niche_relevance  TEXT,
  status           TEXT DEFAULT 'identified',   -- 'identified' | 'submitted' | 'live'
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  submitted_at     TIMESTAMPTZ,
  live_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_citation_opps_client_id ON citation_opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_citation_opps_status    ON citation_opportunities(status);

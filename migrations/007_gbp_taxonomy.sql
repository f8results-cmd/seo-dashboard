-- Migration 007: GBP category taxonomy table
-- Used by category_research_agent.py to validate competitor-researched categories.
-- Seed with: python tools/seed_gbp_taxonomy.py (in seo-platform repo)

CREATE TABLE IF NOT EXISTS gbp_category_taxonomy (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL UNIQUE,
  locale        TEXT NOT NULL DEFAULT 'en-AU',
  source        TEXT NOT NULL DEFAULT 'seed_v1',  -- 'seed_v1' | 'web_search' | 'manual'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gbp_taxonomy_name ON gbp_category_taxonomy(LOWER(category_name));

ALTER TABLE gbp_category_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency_all_gbp_taxonomy" ON gbp_category_taxonomy FOR ALL USING (true);

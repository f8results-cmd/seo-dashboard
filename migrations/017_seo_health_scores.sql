-- Migration 017: SEO Health Score table
-- Stores weekly composite SEO scores (100pt) per client.
-- Replaces rank_tracking as the primary weekly SEO measurement.

CREATE TABLE IF NOT EXISTS seo_health_scores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  score_total      int  NOT NULL CHECK (score_total BETWEEN 0 AND 100),
  score_onsite     int  NOT NULL DEFAULT 0,
  score_gbp        int  NOT NULL DEFAULT 0,
  score_local      int  NOT NULL DEFAULT 0,
  score_ranking    int  NOT NULL DEFAULT 0,
  breakdown        jsonb,           -- full per-item pass/fail + actions list
  keywords_tracked jsonb,           -- [{keyword, rank, pts}]
  scored_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_health_client
  ON seo_health_scores (client_id, scored_at DESC);

COMMENT ON TABLE seo_health_scores IS
  'Weekly composite SEO health scores per client. '
  'breakdown JSONB contains per-category pass/fail items and top 3 action items. '
  'keywords_tracked JSONB stores 10 keyword ranks for the Rankings category.';

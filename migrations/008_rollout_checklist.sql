-- Migration 008: Weekly rollout checklist system
-- Replaces ad-hoc client_tasks with a structured 4-week rollout per client.
-- Weeks are auto-generated from clients.onboarding_date + manages_website flag.

-- ── client_rollout_weeks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_rollout_weeks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_number  INT  NOT NULL,
  week_label   TEXT NOT NULL,          -- e.g. 'Week 1: GBP Setup + Optimisation'
  phase        TEXT NOT NULL,          -- 'gbp_setup' | 'website' | 'website_onpage' | 'citations' | 'ongoing'
  starts_on    DATE NOT NULL,
  ends_on      DATE NOT NULL,          -- always a Friday
  completed    BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_rollout_weeks_client  ON client_rollout_weeks(client_id);
CREATE INDEX IF NOT EXISTS idx_rollout_weeks_ends_on ON client_rollout_weeks(ends_on);

-- ── client_rollout_items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_rollout_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       UUID NOT NULL REFERENCES client_rollout_weeks(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  item_key      TEXT NOT NULL,         -- machine key, e.g. 'gbp_primary_category'
  label         TEXT NOT NULL,         -- human label shown in UI
  category      TEXT,                  -- 'GBP' | 'Website' | 'SEO' | 'Citations' | 'Client'
  sort_order    INT  DEFAULT 0,
  completed     BOOLEAN DEFAULT false,
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollout_items_week   ON client_rollout_items(week_id);
CREATE INDEX IF NOT EXISTS idx_rollout_items_client ON client_rollout_items(client_id);

-- ── Add onboarding_date to clients if missing ─────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_date DATE;

-- ── RLS ───────────────────────────────────────────────────────────────
ALTER TABLE client_rollout_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_rollout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_all_rollout_weeks" ON client_rollout_weeks FOR ALL USING (true);
CREATE POLICY "agency_all_rollout_items" ON client_rollout_items FOR ALL USING (true);

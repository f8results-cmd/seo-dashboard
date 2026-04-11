-- Migration: New tables and columns for dashboard rebuild
-- Run in Supabase SQL editor

-- ---- New columns on clients table ----

ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_friday_update TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS health_score INT DEFAULT 0;

-- ---- client_tasks ----

CREATE TABLE IF NOT EXISTS client_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES clients(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  due_date    DATE,
  priority    TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  completed   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_tasks_client_id ON client_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_client_tasks_due_date  ON client_tasks(due_date);

-- ---- client_notes ----

CREATE TABLE IF NOT EXISTS client_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES clients(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);

-- ---- friday_updates ----

CREATE TABLE IF NOT EXISTS friday_updates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  delivery_method TEXT DEFAULT 'email'
);

CREATE INDEX IF NOT EXISTS idx_friday_updates_client_id ON friday_updates(client_id);

-- ---- RLS policies (service role bypasses these; apply to anon/authenticated) ----

ALTER TABLE client_tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE friday_updates ENABLE ROW LEVEL SECURITY;

-- Agency only (restrict to service role in practice; dashboard uses service client)
CREATE POLICY "agency_all_client_tasks"   ON client_tasks   FOR ALL USING (true);
CREATE POLICY "agency_all_client_notes"   ON client_notes   FOR ALL USING (true);
CREATE POLICY "agency_all_friday_updates" ON friday_updates FOR ALL USING (true);

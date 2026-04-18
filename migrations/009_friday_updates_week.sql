-- Migration 009: Add week_number and sent_by_user_id to friday_updates
-- These let the rollout checklist know which week an update belongs to,
-- and track who manually sent it.

ALTER TABLE friday_updates ADD COLUMN IF NOT EXISTS week_number    INT;
ALTER TABLE friday_updates ADD COLUMN IF NOT EXISTS sent_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for rollout checklist joins
CREATE INDEX IF NOT EXISTS idx_friday_updates_week ON friday_updates(client_id, week_number);

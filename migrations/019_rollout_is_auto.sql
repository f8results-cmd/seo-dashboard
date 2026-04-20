-- Migration 019: Add is_auto flag to client_rollout_items
-- Auto items are completed by the pipeline, not manually by staff.

ALTER TABLE client_rollout_items ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false;

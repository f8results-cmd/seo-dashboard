-- Migration 010: Add gbp_posting_schedule JSONB column to clients
-- Stores competitor-researched posting schedule:
-- {
--   "posts_per_week": 1,
--   "preferred_days": ["Wednesday"],
--   "preferred_time": "09:00",
--   "reasoning": "Competitors post mid-week..."
-- }

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gbp_posting_schedule JSONB;

COMMENT ON COLUMN clients.gbp_posting_schedule IS
  'Competitor-researched GBP posting schedule. '
  'Shape: { posts_per_week, preferred_days, preferred_time, reasoning }';

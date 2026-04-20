-- Migration 016: Add ghl_social_planner_url column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_social_planner_url TEXT;
COMMENT ON COLUMN clients.ghl_social_planner_url IS 'Direct link to this client GHL Social Planner where scheduled GBP posts are managed.';

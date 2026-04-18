-- Migration: Add phase column to client_tasks
-- Values: 'gbp_setup', 'website', 'citations', 'ongoing', 'general'
-- Run in Supabase SQL editor

ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_client_tasks_phase ON client_tasks(phase);

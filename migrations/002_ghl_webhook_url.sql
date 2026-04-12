-- Migration: Add ghl_webhook_url column to clients table
-- Run in Supabase SQL editor

ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_webhook_url TEXT;

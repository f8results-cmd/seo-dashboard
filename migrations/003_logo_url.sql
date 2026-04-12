-- Migration: Add logo_url column to clients table
-- Run in Supabase SQL editor

ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;

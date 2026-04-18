-- Migration 011: Add inspiration_url to clients
-- Optional URL of an existing website whose tone/voice content should match.
-- ContentAgent fetches this URL and uses it as voice-matching guidance only.
-- Content is NEVER copied — only tone and style are analysed.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS inspiration_url TEXT;

COMMENT ON COLUMN clients.inspiration_url IS
  'Optional URL of a website whose tone/voice ContentAgent should match. '
  'Content is never copied — only writing style is analysed.';

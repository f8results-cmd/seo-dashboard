ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_drive_url TEXT;
COMMENT ON COLUMN clients.photo_drive_url IS 'Google Drive folder URL where the client uploads their photos for us to use.';

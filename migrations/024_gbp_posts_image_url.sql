-- Migration 024: add image_url column to gbp_posts
-- GBPAgent selects per-post images for GHL social posts; this column stores the
-- chosen photo URL so it can be included in the GHL payload when GHL is configured.
ALTER TABLE gbp_posts ADD COLUMN IF NOT EXISTS image_url text DEFAULT '';

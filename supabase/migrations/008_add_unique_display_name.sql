-- Add unique constraint to entries.display_name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS entries_display_name_unique_idx ON public.entries (LOWER(display_name));

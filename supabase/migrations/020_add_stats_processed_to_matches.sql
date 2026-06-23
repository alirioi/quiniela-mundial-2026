-- Add stats_processed flag to matches table
-- This column tracks whether player statistics have been automatically
-- synced for each finished match, preventing duplicate processing.

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS stats_processed boolean NOT NULL DEFAULT false;

-- Mark all matches that are already 'finished' as processed,
-- since their stats were loaded manually in previous sessions.
UPDATE public.matches
SET stats_processed = true
WHERE status = 'finished';

COMMENT ON COLUMN public.matches.stats_processed IS
  'True once player_stats have been synced for this match via the auto-sync workflow.';

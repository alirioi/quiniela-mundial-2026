-- Migration 018: Add previous_rank to entries
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS previous_rank integer DEFAULT NULL;

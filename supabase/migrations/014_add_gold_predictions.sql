-- Migration 014: Add Gold Predictions and Tournament Settings
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS predicted_champion text;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS predicted_champion_goals int4;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS predicted_final_goals int4;

-- Create tournament_settings table
CREATE TABLE IF NOT EXISTS public.tournament_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  actual_champion text,
  actual_champion_goals int4,
  actual_final_goals int4,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tournament_settings ENABLE ROW LEVEL SECURITY;

-- Policies for tournament_settings
CREATE POLICY "Allow select tournament_settings for everyone" ON public.tournament_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow all operations for admins on tournament_settings" ON public.tournament_settings
  FOR ALL USING (public.is_admin());

-- Insert initial empty settings row
INSERT INTO public.tournament_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

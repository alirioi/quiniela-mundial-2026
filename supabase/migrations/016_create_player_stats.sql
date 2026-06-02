-- Create player_stats table
create table if not exists public.player_stats (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  team text not null,
  goals integer default 0,
  assists integer default 0,
  yellow_cards integer default 0,
  red_cards integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.player_stats enable row level security;

-- Policies
-- 1. Anyone can read player_stats
create policy "Allow select player_stats for everyone" on public.player_stats
  for select using (true);

-- 2. Only admins can perform write/update/delete operations
create policy "Allow admins all operations on player_stats" on public.player_stats
  for all using (public.is_admin());

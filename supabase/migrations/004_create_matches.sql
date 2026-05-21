-- Create matches table
create table if not exists public.matches (
  id serial primary key,
  phase_id int4 not null references public.tournament_phases(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  match_time timestamptz not null,
  home_score int2,
  away_score int2,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  group_name text,
  match_number int2 not null
);

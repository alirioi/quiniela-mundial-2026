-- Create predictions table
create table if not exists public.predictions (
  id serial primary key,
  entry_id int4 not null references public.entries(id) on delete cascade,
  match_id int4 not null references public.matches(id) on delete cascade,
  predicted_home int2 not null,
  predicted_away int2 not null,
  points_earned int2 not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint predictions_entry_id_match_id_key unique(entry_id, match_id)
);

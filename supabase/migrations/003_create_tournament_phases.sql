-- Create tournament_phases table
create table if not exists public.tournament_phases (
  id serial primary key,
  name text not null,
  slug text not null unique,
  "order" int2 not null,
  is_active boolean not null default false
);

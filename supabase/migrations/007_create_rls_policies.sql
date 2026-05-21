-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.tournament_phases enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

-- Helper security definer functions to prevent recursion
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_approved()
returns boolean as $$
begin
  return exists (
    select 1 from public.entries
    where user_id = auth.uid() and status = 'approved'
  );
end;
$$ language plpgsql security definer;

-- POLICIES

-- 1. profiles policies
create policy "Allow select profiles for owner, approved users or admins" on public.profiles
  for select using (
    auth.uid() = id 
    or public.is_approved() 
    or public.is_admin()
  );

create policy "Allow update profiles for owner (only full_name)" on public.profiles
  for update using (
    auth.uid() = id
  )
  with check (
    auth.uid() = id 
    and role = (select role from public.profiles where id = auth.uid())
  );

create policy "Allow admins all operations on profiles" on public.profiles
  for all using (public.is_admin());


-- 2. entries policies
create policy "Allow select entries for owner, approved entries or admins" on public.entries
  for select using (
    auth.uid() = user_id 
    or (public.is_approved() and status = 'approved') 
    or public.is_admin()
  );

create policy "Allow insert entries for authenticated users" on public.entries
  for insert with check (
    auth.uid() = user_id
  );

create policy "Allow admins all operations on entries" on public.entries
  for all using (public.is_admin());


-- 3. tournament_phases policies
create policy "Allow select phases for approved users or admins" on public.tournament_phases
  for select using (
    public.is_approved() 
    or public.is_admin()
  );

create policy "Allow admins all operations on tournament_phases" on public.tournament_phases
  for all using (public.is_admin());


-- 4. matches policies
create policy "Allow select matches for approved users or admins" on public.matches
  for select using (
    public.is_approved() 
    or public.is_admin()
  );

create policy "Allow admins all operations on matches" on public.matches
  for all using (public.is_admin());


-- 5. predictions policies
create policy "Allow select predictions for owner, finished matches (transparency) or admins" on public.predictions
  for select using (
    exists (select 1 from public.entries where id = entry_id and user_id = auth.uid())
    or (public.is_approved() and exists (select 1 from public.matches where id = match_id and status = 'finished'))
    or public.is_admin()
  );

create policy "Allow insert/update predictions for entry owner if approved" on public.predictions
  for all using (
    exists (select 1 from public.entries where id = entry_id and user_id = auth.uid() and status = 'approved')
  )
  with check (
    exists (select 1 from public.entries where id = entry_id and user_id = auth.uid() and status = 'approved')
  );

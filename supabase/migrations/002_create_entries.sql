-- Create entries table
create table if not exists public.entries (
  id serial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_number int2 not null,
  display_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  payment_receipt_url text,
  total_points int4 not null default 0,
  created_at timestamptz not null default now(),
  constraint entries_user_id_entry_number_key unique(user_id, entry_number)
);

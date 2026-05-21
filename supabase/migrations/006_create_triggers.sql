-- Create functions for triggers

-- 1. handle_new_user
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    'user'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for handle_new_user
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. enforce_prediction_lock
create or replace function public.enforce_prediction_lock()
returns trigger as $$
declare
  v_match_time timestamptz;
begin
  -- Si es una actualización y no se están modificando los goles pronosticados, permitir de inmediato (ej. cálculo de puntos)
  if (TG_OP = 'UPDATE' and old.predicted_home = new.predicted_home and old.predicted_away = new.predicted_away) then
    return new;
  end if;

  select match_time into v_match_time
  from public.matches
  where id = new.match_id;

  if v_match_time is null then
    raise exception 'Partido no encontrado';
  end if;

  if now() >= v_match_time - interval '2 hours' then
    raise exception 'Predicción bloqueada: faltan menos de 2 horas para el partido';
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger for enforce_prediction_lock
create or replace trigger before_prediction_insert_or_update
  before insert or update on public.predictions
  for each row execute procedure public.enforce_prediction_lock();

-- 3. calculate_points
create or replace function public.calculate_points()
returns trigger as $$
begin
  -- Update points for all predictions of this match
  update public.predictions
  set points_earned = case
    when new.home_score is null or new.away_score is null then 0
    when predicted_home = new.home_score and predicted_away = new.away_score then 3
    when sign(predicted_home - predicted_away) = sign(new.home_score - new.away_score) then 1
    else 0
  end
  where match_id = new.id;

  -- Update total_points for all entries that have predictions on this match
  update public.entries e
  set total_points = coalesce((
    select sum(points_earned)
    from public.predictions p
    where p.entry_id = e.id
  ), 0)
  where e.id in (
    select entry_id
    from public.predictions
    where match_id = new.id
  );

  return new;
end;
$$ language plpgsql security definer;

-- Trigger for calculate_points
create or replace trigger after_match_score_update
  after update of home_score, away_score on public.matches
  for each row execute procedure public.calculate_points();

-- 4. update_prediction_timestamp
create or replace function public.update_prediction_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for update_prediction_timestamp
create or replace trigger before_prediction_update_timestamp
  before update on public.predictions
  for each row execute procedure public.update_prediction_timestamp();

-- 1. Crear índices de rendimiento sugeridos
CREATE INDEX IF NOT EXISTS predictions_match_id_idx ON public.predictions(match_id);
CREATE INDEX IF NOT EXISTS matches_phase_id_idx ON public.matches(phase_id);

-- 2. Corregir funciones SECURITY DEFINER agregando search_path seguro y marcando helpers RLS como STABLE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, birth_date, phone)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    'user',
    (new.raw_user_meta_data->>'birth_date')::date,
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS trigger AS $$
DECLARE
  v_match_time timestamptz;
BEGIN
  IF (TG_OP = 'UPDATE' AND old.predicted_home = new.predicted_home AND old.predicted_away = new.predicted_away) THEN
    RETURN new;
  END IF;

  SELECT match_time INTO v_match_time
  FROM public.matches
  WHERE id = new.match_id;

  IF v_match_time IS NULL THEN
    RAISE EXCEPTION 'Partido no encontrado';
  END IF;

  IF now() >= v_match_time - interval '5 minutes' THEN
    RAISE EXCEPTION 'Predicción bloqueada: faltan menos de 5 minutos para el partido';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.calculate_points()
RETURNS trigger AS $$
BEGIN
  UPDATE public.predictions
  SET points_earned = CASE
    WHEN new.home_score IS NULL OR new.away_score IS NULL THEN 0
    WHEN predicted_home = new.home_score AND predicted_away = new.away_score THEN 3
    WHEN sign(predicted_home - predicted_away) = sign(new.home_score - new.away_score) THEN 1
    ELSE 0
  END
  WHERE match_id = new.id;

  UPDATE public.entries e
  SET total_points = coalesce((
    SELECT sum(points_earned)
    from public.predictions p
    where p.entry_id = e.id
  ), 0)
  WHERE e.id IN (
    SELECT entry_id
    from public.predictions
    where match_id = new.id
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.update_prediction_timestamp()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.entries
    WHERE user_id = auth.uid() AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 3. Limitar política de predicciones de FOR ALL a INSERT y UPDATE únicamente
DROP POLICY IF EXISTS "Allow insert/update predictions for entry owner if approved" ON public.predictions;

CREATE POLICY "Allow insert predictions for entry owner if approved" ON public.predictions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.entries WHERE id = entry_id AND user_id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Allow update predictions for entry owner if approved" ON public.predictions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.entries WHERE id = entry_id AND user_id = auth.uid() AND status = 'approved')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.entries WHERE id = entry_id AND user_id = auth.uid() AND status = 'approved')
  );

-- Migration to change prediction lock time from 30 minutes to 5 minutes

CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS trigger AS $$
DECLARE
  v_match_time timestamptz;
BEGIN
  -- Si es una actualización y no se están modificando los goles pronosticados, permitir de inmediato (ej. cálculo de puntos)
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

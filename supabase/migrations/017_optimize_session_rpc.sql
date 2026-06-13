-- Función RPC para obtener los datos de sesión en una sola llamada
CREATE OR REPLACE FUNCTION public.get_session_data(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile record;
  v_entries record;
  v_is_approved boolean := false;
  v_result json;
BEGIN
  -- 1. Obtener el perfil
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  
  -- Si no hay perfil, devolver nulo
  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Obtener todos los entries del usuario en formato JSON array
  SELECT json_agg(row_to_json(e)) INTO v_entries 
  FROM (SELECT * FROM public.entries WHERE user_id = p_user_id) e;

  -- 3. Determinar si está aprobado (si tiene al menos un entry con status = 'approved')
  SELECT EXISTS (
    SELECT 1 FROM public.entries WHERE user_id = p_user_id AND status = 'approved'
  ) INTO v_is_approved;

  -- 4. Construir el resultado JSON
  SELECT json_build_object(
    'profile', row_to_json(v_profile),
    'entries', COALESCE(v_entries.json_agg, '[]'::json),
    'is_approved', v_is_approved
  ) INTO v_result;

  RETURN v_result;
END;
$$;

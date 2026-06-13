-- Migration: 017_optimize_session_fetch.sql
-- Description: Create a function to fetch user profile and entries in a single request to reduce API roundtrips.

CREATE OR REPLACE FUNCTION public.get_user_context(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile JSONB;
  v_entries JSONB;
  v_is_approved BOOLEAN;
BEGIN
  -- 1. Obtener el perfil del usuario
  SELECT to_jsonb(p) INTO v_profile 
  FROM public.profiles p 
  WHERE p.id = p_user_id;

  -- Si no existe el perfil, retornamos nulo para el contexto
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object(
      'profile', NULL,
      'entries', '[]'::jsonb,
      'is_approved', FALSE
    );
  END IF;

  -- 2. Obtener todos los cupos asociados al usuario
  SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO v_entries 
  FROM public.entries e 
  WHERE e.user_id = p_user_id;

  -- 3. Determinar si el usuario tiene al menos un cupo aprobado
  -- Buscamos directamente en la tabla por eficiencia
  SELECT EXISTS (
    SELECT 1 FROM public.entries 
    WHERE user_id = p_user_id AND status = 'approved'
  ) INTO v_is_approved;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'entries', v_entries,
    'is_approved', COALESCE(v_is_approved, FALSE)
  );
END;
$$;

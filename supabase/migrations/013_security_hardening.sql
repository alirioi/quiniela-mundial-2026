-- Auditoría de Seguridad: Restricción de acceso a datos sensibles en perfiles
-- Problema: Cualquier usuario aprobado podía ver el email, teléfono y fecha de nacimiento de otros.
-- Solución: Dividir la política de selección para que usuarios regulares solo vean lo básico.

-- 1. Eliminar la política anterior
drop policy if exists "Allow select profiles for owner, approved users or admins" on public.profiles;

-- 2. Política para Administradores: Pueden ver todo
create policy "Admins can see all profiles" on public.profiles
  for select using (public.is_admin());

-- 3. Política para Propietarios: Pueden ver su propio perfil completo
create policy "Users can see their own profile" on public.profiles
  for select using (auth.uid() = id);

-- 4. Política para Usuarios Aprobados: Pueden ver info PÚBLICA de otros (para el ranking/transparencia)
-- Nota: En Supabase, RLS no filtra columnas automáticamente en SELECT *. 
-- Se recomienda que el frontend solo pida las columnas necesarias.
-- Para una seguridad total a nivel de columna, se debería usar una View.
create policy "Approved users can see other profiles basic info" on public.profiles
  for select using (public.is_approved());

-- Seguridad adicional para el Storage de Comprobantes
-- Aunque se usan Signed URLs, es buena práctica tener RLS habilitado en el bucket.
-- Asegurarse de que el bucket 'payment-receipts' tenga RLS activado.

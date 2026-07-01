import { supabaseAdmin } from '../lib/supabase-server';

/**
 * Verifica si el usuario está autenticado. Si no lo está, retorna un Response de error 401.
 */
export function requireAuth(locals: any): Response | null {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }
  return null;
}

/**
 * Verifica si el usuario tiene rol de administrador. Si no lo tiene, retorna un Response de error 403.
 */
export function requireAdmin(locals: any): Response | null {
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado (se requiere rol admin)' }), { status: 403 });
  }
  return null;
}

/**
 * Valida que una entry exista, que pertenezca al usuario logueado, y opcionalmente valida su estado.
 * Si falla, retorna un objeto { error: Response }. Si tiene éxito, retorna { entry }.
 */
export async function validateEntryOwnership(
  entryId: number,
  userId: string,
  requiredStatus?: string
): Promise<{ entry?: any; error?: Response }> {
  const { data: entry, error: entryError } = await supabaseAdmin
    .from('entries')
    .select('user_id, status')
    .eq('id', entryId)
    .single();

  if (entryError || !entry) {
    return { error: new Response(JSON.stringify({ error: 'Cupo no encontrado' }), { status: 404 }) };
  }
  if (entry.user_id !== userId) {
    return { error: new Response(JSON.stringify({ error: 'Acceso denegado a este cupo' }), { status: 403 }) };
  }
  if (requiredStatus && entry.status !== requiredStatus) {
    return { error: new Response(JSON.stringify({ error: `El cupo debe estar en estado: ${requiredStatus}` }), { status: 403 }) };
  }

  return { entry };
}

/**
 * Obtiene todos los participantes aprobados, excluyendo a los administradores.
 */
export async function getApprovedNonAdminEntries() {
  const { data: rawEntries, error } = await supabaseAdmin
    .from('entries')
    .select('id, display_name, entry_number, profiles(role, full_name)')
    .eq('status', 'approved');

  if (error) {
    return { entries: null, error };
  }

  const entries = rawEntries?.filter((entry: any) => entry.profiles?.role !== 'admin') || [];
  return { entries, error: null };
}

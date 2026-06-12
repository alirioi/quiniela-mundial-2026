export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const entryIdParam = url.searchParams.get('entryId');
  const matchIdsParam = url.searchParams.get('matchIds');

  if (!entryIdParam || !matchIdsParam) {
    return new Response(JSON.stringify({ error: 'Faltan parámetros' }), { status: 400 });
  }

  const entryId = parseInt(entryIdParam, 10);
  const matchIds = matchIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));

  if (isNaN(entryId) || matchIds.length === 0) {
    return new Response(JSON.stringify({ error: 'Parámetros no válidos' }), { status: 400 });
  }

  try {
    // 1. Validar propiedad del cupo y que esté aprobado
    const { data: entry, error: entryError } = await supabaseAdmin
      .from('entries')
      .select('user_id, status')
      .eq('id', entryId)
      .single();

    if (entryError || !entry) {
      return new Response(JSON.stringify({ error: 'Cupo no encontrado' }), { status: 404 });
    }

    if (entry.user_id !== user.id && locals.profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Acceso denegado a este cupo' }), { status: 403 });
    }

    if (entry.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'El cupo debe estar aprobado' }), { status: 403 });
    }

    // 2. Obtener predicciones para los partidos solicitados
    const { data: predictions, error: predictionsError } = await supabaseAdmin
      .from('predictions')
      .select('id, match_id, predicted_home, predicted_away')
      .eq('entry_id', entryId)
      .in('match_id', matchIds);

    if (predictionsError) {
      return new Response(JSON.stringify({ error: predictionsError.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ predictions: predictions || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Error interno del servidor' }), { status: 500 });
  }
};

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-server';

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    // 1. Obtener fases activas
    const { data: activePhases, error: phasesError } = await supabaseAdmin
      .from('tournament_phases')
      .select('id, name, slug')
      .eq('is_active', true);

    if (phasesError) {
      return new Response(JSON.stringify({ error: phasesError.message }), { status: 400 });
    }

    const activePhaseIds = activePhases.map((p) => p.id);

    // 2. Contar partidos en las fases activas
    let activeMatchesCount = 0;
    let activeMatchIds: number[] = [];
    if (activePhaseIds.length > 0) {
      const { data: activeMatches, error: matchesError } = await supabaseAdmin
        .from('matches')
        .select('id')
        .in('phase_id', activePhaseIds);

      if (!matchesError && activeMatches) {
        activeMatchesCount = activeMatches.length;
        activeMatchIds = activeMatches.map((m) => m.id);
      }
    }

    // 3. Obtener entradas aprobadas del usuario
    const { data: userEntries, error: entriesError } = await supabaseAdmin
      .from('entries')
      .select('id, display_name, entry_number, status, total_points')
      .eq('user_id', user.id)
      .eq('status', 'approved');

    if (entriesError || !userEntries) {
      return new Response(JSON.stringify({ error: entriesError?.message || 'Error al obtener entradas' }), { status: 400 });
    }

    // 4. Para cada entrada, ver cuántas predicciones guardadas tiene para los partidos activos
    const entriesWithPending = await Promise.all(
      userEntries.map(async (entry) => {
        if (activeMatchIds.length === 0) {
          return {
            ...entry,
            pendingPredictions: 0,
            activePhases: activePhases,
          };
        }

        const { count, error: countError } = await supabaseAdmin
          .from('predictions')
          .select('*', { count: 'exact', head: true })
          .eq('entry_id', entry.id)
          .in('match_id', activeMatchIds);

        const savedCount = count || 0;
        const pendingCount = activeMatchesCount - savedCount;

        return {
          ...entry,
          pendingPredictions: pendingCount < 0 ? 0 : pendingCount,
          activePhases: activePhases,
        };
      })
    );

    return new Response(JSON.stringify(entriesWithPending), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

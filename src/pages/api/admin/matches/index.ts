import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export const GET: APIRoute = async ({ request, locals }) => {
  // Explicit admin check
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  try {
    // Obtener fases
    const { data: phases, error: phasesError } = await supabaseAdmin
      .from('tournament_phases')
      .select('*')
      .order('order', { ascending: true });

    if (phasesError) {
      return new Response(JSON.stringify({ error: phasesError.message }), { status: 400 });
    }

    // Obtener todos los partidos ordenados por hora
    const { data: matches, error: matchesError } = await supabaseAdmin
      .from('matches')
      .select(`
        id,
        phase_id,
        home_team,
        away_team,
        match_time,
        home_score,
        away_score,
        status,
        group_name,
        match_number
      `)
      .order('match_time', { ascending: true });

    if (matchesError) {
      return new Response(JSON.stringify({ error: matchesError.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ phases, matches }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

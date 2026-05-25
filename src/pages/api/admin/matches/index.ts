export const prerender = false;
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

    // Fetch entries and predictions for stats
    const { data: entries } = await supabaseAdmin
      .from('entries')
      .select('id')
      .eq('status', 'approved');

    const { data: predictions } = await supabaseAdmin
      .from('predictions')
      .select('entry_id, match_id');

    const approvedCount = entries?.length || 0;
    
    // Calculate stats per phase
    const phasesStats = phases.map(phase => {
      const matchesInPhase = matches.filter(m => m.phase_id === phase.id);
      const totalMatches = matchesInPhase.length;
      
      let completedCount = 0;
      if (totalMatches > 0 && entries && predictions) {
        entries.forEach(entry => {
          let count = 0;
          for (const match of matchesInPhase) {
            if (predictions.some(p => p.entry_id === entry.id && p.match_id === match.id)) {
              count++;
            }
          }
          if (count === totalMatches) completedCount++;
        });
      }

      return {
        phase_id: phase.id,
        total_matches: totalMatches,
        completed_count: completedCount,
        total_approved: approvedCount
      };
    });

    return new Response(JSON.stringify({ phases, matches, phasesStats }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

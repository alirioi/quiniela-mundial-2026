export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { calculateGroupStandings, calculateKnockoutBracket, isPlaceholderName } from '../../../../utils/knockout';

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
        match_number,
        penalty_winner
      `)
      .order('match_time', { ascending: true });

    if (matchesError) {
      return new Response(JSON.stringify({ error: matchesError.message }), { status: 400 });
    }

    // Calculate actual matchups
    const { groupStandings, thirdPlaces } = calculateGroupStandings(matches || []);
    const bracket = calculateKnockoutBracket(groupStandings, thirdPlaces, undefined, matches || []);
    
    // Create a flat map of knockout matches by match_number
    const knockoutMatchesByNumber = new Map();
    [
      ...Object.values(bracket.r32),
      ...Object.values(bracket.r16),
      ...Object.values(bracket.qf),
      ...Object.values(bracket.sf),
      bracket.finalMatch,
      bracket.thirdPlaceMatch
    ].filter(Boolean).forEach(km => {
      knockoutMatchesByNumber.set(km.matchNumber, km);
    });

    // Update matches in-memory with real names if available
    matches?.forEach(match => {
      const km = knockoutMatchesByNumber.get(match.match_number);
      if (km) {
        if (!isPlaceholderName(km.homeTeam)) {
          match.home_team = km.homeTeam;
        }
        if (!isPlaceholderName(km.awayTeam)) {
          match.away_team = km.awayTeam;
        }
      }
    });

    // Fetch entries and predictions for stats (excluding admin accounts)
    const { data: rawEntries } = await supabaseAdmin
      .from('entries')
      .select('id, user_id, display_name, profiles(role, full_name)')
      .eq('status', 'approved');

    const entries = rawEntries?.filter((entry: any) => entry.profiles?.role !== 'admin') || [];

    const approvedCount = entries.length;

    // Encontrar el siguiente partido programado en cada fase
    const nextMatches = phases.map(phase => {
      const matchesInPhase = matches.filter(m => m.phase_id === phase.id);
      return matchesInPhase
        .filter(m => m.status === 'scheduled')
        .sort((a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime())[0];
    });

    const nextMatchIds = nextMatches.filter(Boolean).map(m => m.id);

    // Fetch predictions ONLY for the next matches to avoid the 1000 rows limit from PostgREST
    const { data: predictions } = await supabaseAdmin
      .from('predictions')
      .select('entry_id, match_id')
      .in('match_id', nextMatchIds.length > 0 ? nextMatchIds : [0]);

    // Fetch profiles to get the names for missing participants
    const { data: rawProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name');
    const profileMap = new Map((rawProfiles || []).map(p => [p.id, p.full_name]));

    // Calculate stats per phase based on the NEXT scheduled match
    const phasesStats = phases.map((phase, index) => {
      const nextMatch = nextMatches[index];
      let missingUsers: { id: string; name: string }[] = [];
      
      if (nextMatch && entries && predictions) {
        entries.forEach(entry => {
          const hasPredicted = predictions.some(p => p.entry_id === entry.id && p.match_id === nextMatch.id);
          if (!hasPredicted) {
            // Utilizamos el nombre del perfil o en su defecto el de la entrada
            const name = entry.profiles?.full_name || entry.display_name || 'Desconocido';
            missingUsers.push({ id: entry.id, name });
          }
        });
      }

      return {
        phase_id: phase.id,
        next_match: nextMatch ? {
          id: nextMatch.id,
          home_team: nextMatch.home_team,
          away_team: nextMatch.away_team,
          match_time: nextMatch.match_time
        } : null,
        missing_users: missingUsers,
        total_approved: approvedCount
      };
    });

    return new Response(JSON.stringify({ phases, matches, phasesStats }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

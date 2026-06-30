export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const GET: APIRoute = async ({ params, url, locals }) => {
  const { phase } = params;
  const entryIdParam = url.searchParams.get('entryId');

  if (!phase) {
    return new Response(JSON.stringify({ error: 'Fase no especificada' }), { status: 400 });
  }

  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    // 1. Obtener la fase para validar y tener su id
    const { data: phaseData, error: phaseError } = await supabaseAdmin
      .from('tournament_phases')
      .select('*')
      .eq('slug', phase)
      .single();

    if (phaseError || !phaseData) {
      return new Response(JSON.stringify({ error: 'Fase no encontrada' }), { status: 404 });
    }

    // 2. Obtener partidos de esa fase
    const { data: matches, error: matchesError } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('phase_id', phaseData.id)
      .order('match_number', { ascending: true });

    if (matchesError) {
      return new Response(JSON.stringify({ error: matchesError.message }), { status: 400 });
    }

    // Resolver placeholders usando la lógica de knockout
    const { data: allMatches } = await supabaseAdmin
      .from('matches')
      .select('id, phase_id, home_team, away_team, match_time, home_score, away_score, status, group_name, match_number, penalty_winner')
      .order('match_time', { ascending: true });

    if (allMatches) {
      const { calculateGroupStandings, calculateKnockoutBracket, isPlaceholderName } = await import('../../../utils/knockout');
      const { groupStandings, thirdPlaces } = calculateGroupStandings(allMatches);
      const bracket = calculateKnockoutBracket(groupStandings, thirdPlaces, undefined, allMatches);
      
      const knockoutMatchesByNumber = new Map();
      [
        ...Object.values(bracket.r32),
        ...Object.values(bracket.r16),
        ...Object.values(bracket.qf),
        ...Object.values(bracket.sf),
        bracket.finalMatch,
        bracket.thirdPlaceMatch
      ].filter(Boolean).forEach(km => knockoutMatchesByNumber.set(km.matchNumber, km));

      matches.forEach(match => {
        const km = knockoutMatchesByNumber.get(match.match_number);
        if (km) {
          if (!isPlaceholderName(km.homeTeam)) match.home_team = km.homeTeam;
          if (!isPlaceholderName(km.awayTeam)) match.away_team = km.awayTeam;
        }
      });
    }

    // 3. Si se especifica entryId, buscar y adjuntar las predicciones correspondientes
    if (entryIdParam) {
      const entryId = parseInt(entryIdParam, 10);
      
      // Validar que la entry pertenezca al usuario autenticado (para seguridad de RLS)
      const { data: entryData, error: entryError } = await supabaseAdmin
        .from('entries')
        .select('user_id')
        .eq('id', entryId)
        .single();

      if (entryError || !entryData) {
        return new Response(JSON.stringify({ error: 'Cupo no encontrado' }), { status: 404 });
      }

      if (entryData.user_id !== user.id && locals.profile?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acceso denegado a este cupo' }), { status: 403 });
      }

      // Obtener predicciones del cupo
      const { data: predictions, error: predictionsError } = await supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('entry_id', entryId);

      if (predictionsError) {
        return new Response(JSON.stringify({ error: predictionsError.message }), { status: 400 });
      }

      // Combinar partidos con predicciones correspondientes
      const matchesWithPredictions = matches.map((match) => {
        const prediction = predictions.find((p) => p.match_id === match.id);
        return {
          ...match,
          prediction: prediction
            ? {
                id: prediction.id,
                predicted_home: prediction.predicted_home,
                predicted_away: prediction.predicted_away,
                predicted_winner: prediction.predicted_winner,
                points_earned: prediction.points_earned,
              }
            : null,
        };
      });

      return new Response(JSON.stringify({ phase: phaseData, matches: matchesWithPredictions }), { status: 200 });
    }

    return new Response(JSON.stringify({ phase: phaseData, matches }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

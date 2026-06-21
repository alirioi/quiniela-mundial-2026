export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  const profile = locals.profile;

  // Verify auth
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    // 0. Obtener los entries del usuario logueado para verificar aprobación de forma robusta y guardar sus IDs
    const { data: userEntries, error: userEntriesError } = await supabaseAdmin
      .from('entries')
      .select('id, status')
      .eq('user_id', user.id);

    if (userEntriesError) {
      return new Response(JSON.stringify({ error: userEntriesError.message }), { status: 400 });
    }

    const isUserApproved = userEntries?.some(e => e.status === 'approved') || false;

    // Check approval (must have at least one approved entry or be admin)
    if (!isUserApproved && profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'No autorizado (cupo no aprobado)' }), { status: 403 });
    }

    const userEntryIds = new Set(userEntries?.map(e => e.id) || []);

    // 1. Encontrar el partido actual (buscar 'live', luego 'scheduled' más próximo, luego el último 'finished')
    let match = null;

    // Buscar partido en vivo
    const { data: liveMatches, error: liveError } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('status', 'live')
      .order('match_time', { ascending: true })
      .limit(1);

    if (liveError) {
      return new Response(JSON.stringify({ error: liveError.message }), { status: 400 });
    }

    if (liveMatches && liveMatches.length > 0) {
      match = liveMatches[0];
    } else {
      // Si no hay en vivo, buscar el siguiente programado
      const { data: scheduledMatches, error: schedError } = await supabaseAdmin
        .from('matches')
        .select('*')
        .eq('status', 'scheduled')
        .order('match_time', { ascending: true })
        .limit(1);

      if (schedError) {
        return new Response(JSON.stringify({ error: schedError.message }), { status: 400 });
      }

      if (scheduledMatches && scheduledMatches.length > 0) {
        match = scheduledMatches[0];
      } else {
        // Si no hay programados, buscar el último finalizado
        const { data: finishedMatches, error: finError } = await supabaseAdmin
          .from('matches')
          .select('*')
          .eq('status', 'finished')
          .order('match_time', { ascending: false })
          .limit(1);

        if (finError) {
          return new Response(JSON.stringify({ error: finError.message }), { status: 400 });
        }

        if (finishedMatches && finishedMatches.length > 0) {
          match = finishedMatches[0];
        }
      }
    }

    if (!match) {
      return new Response(JSON.stringify({ match: null, predictions: [] }), { status: 200 });
    }

    // 3. Obtener todos los participantes aprobados (excluyendo administradores)
    const { data: rawEntries, error: entriesError } = await supabaseAdmin
      .from('entries')
      .select('id, display_name, entry_number, profiles(role)')
      .eq('status', 'approved');

    if (entriesError) {
      return new Response(JSON.stringify({ error: entriesError.message }), { status: 400 });
    }

    const entries = rawEntries?.filter((entry: any) => entry.profiles?.role !== 'admin') || [];

    // 4. Obtener todas las predicciones para el partido seleccionado
    const { data: predictions, error: predictionsError } = await supabaseAdmin
      .from('predictions')
      .select('entry_id, predicted_home, predicted_away, points_earned')
      .eq('match_id', match.id);

    if (predictionsError) {
      return new Response(JSON.stringify({ error: predictionsError.message }), { status: 400 });
    }

    const predictionsMap = new Map();
    predictions?.forEach((p) => {
      predictionsMap.set(p.entry_id, p);
    });

    const matchTimeMs = new Date(match.match_time).getTime();
    const nowMs = Date.now();
    const lockTimeMs = matchTimeMs - 5 * 60 * 1000; // 5 minutos antes del partido
    const isLocked = nowMs >= lockTimeMs;

    const isMatchScheduled = match.status === 'scheduled';

    // Combinar participantes con sus predicciones y enmascarar si corresponde
    const mergedData = entries.map((entry) => {
      const pred = predictionsMap.get(entry.id);
      const isOwnEntry = userEntryIds.has(entry.id);
      
      // Ocultar pronósticos si el partido no ha iniciado, no está bloqueado (<5m) y no es su propio cupo
      const hidePrediction = isMatchScheduled && !isLocked && !isOwnEntry;

      return {
        entry_id: entry.id,
        display_name: entry.display_name,
        entry_number: entry.entry_number,
        predicted_home: (pred && !hidePrediction) ? pred.predicted_home : null,
        predicted_away: (pred && !hidePrediction) ? pred.predicted_away : null,
        points_earned: pred ? pred.points_earned : 0,
        has_prediction: !!pred,
        is_own: isOwnEntry,
      };
    });

    // Calcular tendencias agregadas basadas en pronósticos reales
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let totalPredictions = 0;

    predictions?.forEach((p) => {
      const associatedEntry = entries.find(e => e.id === p.entry_id);
      if (associatedEntry && p.predicted_home !== null && p.predicted_away !== null) {
        totalPredictions++;
        if (p.predicted_home > p.predicted_away) homeWins++;
        else if (p.predicted_home === p.predicted_away) draws++;
        else awayWins++;
      }
    });

    const tendencies = {
      home_win_percent: totalPredictions > 0 ? Math.round((homeWins / totalPredictions) * 100) : 0,
      draw_percent: totalPredictions > 0 ? Math.round((draws / totalPredictions) * 100) : 0,
      away_win_percent: totalPredictions > 0 ? Math.round((awayWins / totalPredictions) * 100) : 0,
      total_predictions: totalPredictions
    };

    return new Response(JSON.stringify({ match, predictions: mergedData, tendencies }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

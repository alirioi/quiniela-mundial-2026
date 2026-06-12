export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const url = new URL(request.url);
  const entryIdStr = url.searchParams.get('entryId');
  if (!entryIdStr) {
    return new Response(JSON.stringify({ error: 'Falta entryId' }), { status: 400 });
  }
  const entryId = parseInt(entryIdStr);

  // Verificar que el cupo pertenece al usuario o es administrador
  const { data: entry, error: entryError } = await supabaseAdmin
    .from('entries')
    .select('id, display_name, total_points, user_id, status')
    .eq('id', entryId)
    .single();

  if (entryError || !entry) {
    return new Response(JSON.stringify({ error: 'Cupo no encontrado' }), { status: 404 });
  }

  if (entry.user_id !== user.id && locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  try {
    // 1. Obtener Ranking de la tabla de posiciones general
    const { data: adminProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin');
    const adminIds = adminProfiles?.map(p => p.id) || [];

    // Obtener configuraciones del torneo (resultados reales oficiales)
    const { data: settings } = await supabaseAdmin
      .from('tournament_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    let standingsQuery = supabaseAdmin
      .from('entries')
      .select('id, display_name, total_points, created_at, predicted_champion, predicted_champion_goals, predicted_final_goals')
      .eq('status', 'approved');

    if (adminIds.length > 0) {
      standingsQuery = standingsQuery.not('user_id', 'in', `(${adminIds.join(',')})`);
    }

    const { data: standings } = await standingsQuery;

    const maxPoints = standings && standings.length > 0 ? Math.max(...standings.map(s => s.total_points)) : 0;

    // Lógica de ordenación idéntica
    const sortedStandings = [...(standings || [])].sort((a, b) => {
      // 1. Criterio Principal: Puntos totales (Descendente)
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }

      // Si hay empate de puntos y los resultados oficiales ya están disponibles
      if (settings && settings.actual_champion) {
        const aChamp = a.predicted_champion?.trim().toLowerCase();
        const bChamp = b.predicted_champion?.trim().toLowerCase();
        const actualChamp = settings.actual_champion.trim().toLowerCase();

        const aChampionMatched = aChamp === actualChamp;
        const bChampionMatched = bChamp === actualChamp;

        // Criterio 1: Campeón Exacto
        if (aChampionMatched && !bChampionMatched) return -1;
        if (!aChampionMatched && bChampionMatched) return 1;

        // Criterio 2: Goles del Campeón (Menor diferencia absoluta)
        if (settings.actual_champion_goals !== null && settings.actual_champion_goals !== undefined) {
          const aGoalsDiff = Math.abs((a.predicted_champion_goals || 0) - settings.actual_champion_goals);
          const bGoalsDiff = Math.abs((b.predicted_champion_goals || 0) - settings.actual_champion_goals);

          if (aGoalsDiff !== bGoalsDiff) {
            return aGoalsDiff - bGoalsDiff;
          }
        }

        // Criterio 3: Goles en la Final (Menor diferencia absoluta)
        if (settings.actual_final_goals !== null && settings.actual_final_goals !== undefined) {
          const aFinalDiff = Math.abs((a.predicted_final_goals || 0) - settings.actual_final_goals);
          const bFinalDiff = Math.abs((b.predicted_final_goals || 0) - settings.actual_final_goals);

          if (aFinalDiff !== bFinalDiff) {
            return aFinalDiff - bFinalDiff;
          }
        }
      } else {
        // Mientras no entre en acción el pronóstico de oro, y están empatados en el primer lugar
        if (a.total_points === maxPoints) {
          return a.display_name.localeCompare(b.display_name, 'es');
        }
      }

      // Fallback final: Fecha de registro (created_at Ascendente, el que se registró primero queda arriba)
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return a.id - b.id;
    });

    const rankIndex = sortedStandings.findIndex(s => s.id === entryId);
    const ranking = rankIndex !== -1 ? rankIndex + 1 : null;
    const totalParticipants = sortedStandings.length;

    // 2. Obtener estadísticas de predicciones
    const { data: predictions, error: predError } = await supabaseAdmin
      .from('predictions')
      .select(`
        match_id,
        predicted_home,
        predicted_away,
        points_earned,
        matches (
          home_team,
          away_team,
          home_score,
          away_score,
          status,
          match_time
        )
      `)
      .eq('entry_id', entryId);

    if (predError) {
      return new Response(JSON.stringify({ error: predError.message }), { status: 400 });
    }

    const totalPredictions = predictions?.length || 0;
    
    // Filtrar predicciones en partidos que ya han terminado
    const finishedPredictions = predictions?.filter(p => p.matches && p.matches.status === 'finished') || [];
    const finishedPredictionsCount = finishedPredictions.length;
    
    // Contar correctas y exactas únicamente de los partidos finalizados
    const correctPredictions = finishedPredictions.filter(p => p.points_earned !== null && p.points_earned > 0).length;
    const exactPredictions = finishedPredictions.filter(p => p.points_earned === 3).length;

    const accuracyRate = finishedPredictionsCount > 0 ? (correctPredictions / finishedPredictionsCount) * 100 : 0;

    // Formatear el historial de partidos finalizados
    const history = (predictions || [])
      .filter(p => p.matches && p.matches.status === 'finished')
      .map(p => ({
        matchId: p.match_id,
        homeTeam: p.matches.home_team,
        awayTeam: p.matches.away_team,
        predictedHome: p.predicted_home,
        predictedAway: p.predicted_away,
        actualHome: p.matches.home_score,
        actualAway: p.matches.away_score,
        pointsEarned: p.points_earned,
        matchTime: p.matches.match_time
      }))
      .sort((a, b) => new Date(b.matchTime).getTime() - new Date(a.matchTime).getTime());

    return new Response(JSON.stringify({
      totalPoints: entry.total_points,
      ranking,
      totalParticipants,
      totalPredictions,
      correctPredictions,
      exactPredictions,
      accuracyRate,
      history
    }), { status: 200 });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

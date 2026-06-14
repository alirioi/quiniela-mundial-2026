export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-server';

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    // 1. Obtener la fecha del primer partido y verificar si hay partidos activos en paralelo
    const [firstMatchRes, activeMatchesRes] = await Promise.all([
      supabaseAdmin
        .from('matches')
        .select('match_time')
        .order('match_time', { ascending: true })
        .limit(1)
        .single(),
      supabaseAdmin
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'scheduled')
    ]);

    const firstMatch = firstMatchRes.data;
    const activeMatchesCount = activeMatchesRes.count;

    const firstMatchTimeStr = firstMatch?.match_time || '2026-06-11T19:00:00Z';
    const firstMatchTime = new Date(firstMatchTimeStr);
    const now = new Date();

    const tournamentStarted = (activeMatchesCount !== null && activeMatchesCount > 0) || now >= firstMatchTime;

    if (!tournamentStarted) {
      return new Response(JSON.stringify({
        tournamentStarted: false,
        firstMatchTime: firstMatchTimeStr,
        standings: []
      }), { status: 200 });
    }

    // 3. Si el torneo ya comenzó, obtener standings
    // Obtener IDs de administradores para excluirlos
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

    let query = supabaseAdmin
      .from('entries')
      .select('id, display_name, total_points, created_at, predicted_champion, predicted_champion_goals, predicted_final_goals, previous_rank')
      .eq('status', 'approved');

    if (adminIds.length > 0) {
      query = query.not('user_id', 'in', `(${adminIds.join(',')})`);
    }

    let { data: standings, error } = await query;

    if (error) {
      // Fallback in case previous_rank doesn't exist yet on remote db
      let fallbackQuery = supabaseAdmin
        .from('entries')
        .select('id, display_name, total_points, created_at, predicted_champion, predicted_champion_goals, predicted_final_goals')
        .eq('status', 'approved');
      if (adminIds.length > 0) {
        fallbackQuery = fallbackQuery.not('user_id', 'in', `(${adminIds.join(',')})`);
      }
      const fallbackRes = await fallbackQuery;
      if (fallbackRes.error) {
        return new Response(JSON.stringify({ error: fallbackRes.error.message }), { status: 400 });
      }
      standings = fallbackRes.data?.map(s => ({ ...s, previous_rank: null })) || [];
    }

    const maxPoints = standings && standings.length > 0 ? Math.max(...standings.map(s => s.total_points)) : 0;

    // Ordenar standings con lógica de desempate
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
        // Mientras no entre en acción el pronóstico de oro, y están empatados en cualquier posición, se ordena por orden alfabético
        return a.display_name.localeCompare(b.display_name, 'es');
      }

      return a.id - b.id;
    });

    return new Response(JSON.stringify({
      tournamentStarted: true,
      standings: sortedStandings
    }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

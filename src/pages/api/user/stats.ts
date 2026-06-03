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

    let standingsQuery = supabaseAdmin
      .from('entries')
      .select('id, total_points, created_at')
      .eq('status', 'approved');

    if (adminIds.length > 0) {
      standingsQuery = standingsQuery.not('user_id', 'in', `(${adminIds.join(',')})`);
    }

    const { data: standings } = await standingsQuery;

    // Lógica de ordenación idéntica
    const sortedStandings = [...(standings || [])].sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
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
    
    // Contar correctas (outcome correcto: puntos_earned > 0)
    const correctPredictions = predictions?.filter(p => p.points_earned !== null && p.points_earned > 0).length || 0;
    const exactPredictions = predictions?.filter(p => p.points_earned === 3).length || 0;

    const accuracyRate = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;

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

export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { resolveKnockoutTeamNames, isMatchLocked } from '../../../utils/matches';
import { requireAuth } from '../../../utils/api-helpers';

export const GET: APIRoute = async ({ url, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const user = locals.user;

  const entryIdParam = url.searchParams.get('entryId');
  if (!entryIdParam) {
    return new Response(JSON.stringify({ error: 'Falta el parámetro entryId' }), { status: 400 });
  }

  const entryId = parseInt(entryIdParam, 10);
  if (isNaN(entryId)) {
    return new Response(JSON.stringify({ error: 'Parámetro entryId inválido' }), { status: 400 });
  }

  try {
    // 1. Obtener información básica del cupo
    const { data: entry, error: entryError } = await supabaseAdmin
      .from('entries')
      .select('id, display_name, user_id')
      .eq('id', entryId)
      .single();

    if (entryError || !entry) {
      return new Response(JSON.stringify({ error: 'Cupo no encontrado' }), { status: 404 });
    }

    // 2. Obtener todos los partidos y ordenar por fecha/hora (Descendente: más reciente primero)
    const { data: matches, error: matchesError } = await supabaseAdmin
      .from('matches')
      .select('*')
      .order('match_time', { ascending: false });

    if (matchesError || !matches) {
      return new Response(JSON.stringify({ error: matchesError?.message || 'Error al obtener partidos' }), { status: 400 });
    }

    // Resolver placeholders usando la lógica centralizada
    if (matches && matches.length > 0) {
      await resolveKnockoutTeamNames(matches);
    }

    // 3. Obtener todas las predicciones del cupo
    const { data: predictions, error: predictionsError } = await supabaseAdmin
      .from('predictions')
      .select('*')
      .eq('entry_id', entryId);

    if (predictionsError) {
      return new Response(JSON.stringify({ error: predictionsError.message }), { status: 400 });
    }

    const predictionsMap = new Map();
    predictions?.forEach((p) => {
      predictionsMap.set(p.match_id, p);
    });

    const isOwnEntry = entry.user_id === user.id || locals.profile?.role === 'admin';

    // 4. Mapear partidos con la predicción correspondiente aplicando la regla de visibilidad (lock de 5 mins)
    const history = matches
      .map((match) => {
        const pred = predictionsMap.get(match.id);
        const isLocked = isMatchLocked(match.match_time);

        // Un partido se puede ver si ya está bloqueado (<5m del inicio), si está en vivo, si ya finalizó, o si es el propio cupo del usuario.
        const canSee = isLocked || match.status === 'live' || match.status === 'finished' || isOwnEntry;

        return {
          match_id: match.id,
          home_team: match.home_team,
          away_team: match.away_team,
          match_time: match.match_time,
          home_score: match.home_score,
          away_score: match.away_score,
          status: match.status,
          group_name: match.group_name,
          match_number: match.match_number,
          isLocked,
          prediction: (pred && canSee) ? {
            predicted_home: pred.predicted_home,
            predicted_away: pred.predicted_away,
            points_earned: pred.points_earned,
          } : (pred && !canSee) ? {
            hidden: true
          } : null
        };
      })
      .filter((m) => m.status === 'finished' || m.status === 'live' || m.isLocked);

    return new Response(JSON.stringify({
      displayName: entry.display_name,
      history
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Error interno del servidor' }), { status: 500 });
  }
};

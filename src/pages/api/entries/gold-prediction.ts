export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const { entryId, predictedChampion, predictedChampionGoals, predictedFinalGoals } = await request.json();

    if (!entryId || !predictedChampion || predictedChampionGoals === undefined || predictedFinalGoals === undefined) {
      return new Response(JSON.stringify({ error: 'Todos los campos son obligatorios' }), { status: 400 });
    }

    const champGoals = parseInt(predictedChampionGoals, 10);
    const finalGoals = parseInt(predictedFinalGoals, 10);

    if (isNaN(champGoals) || champGoals < 0 || isNaN(finalGoals) || finalGoals < 0) {
      return new Response(JSON.stringify({ error: 'La cantidad de goles debe ser un número entero mayor o igual a cero' }), { status: 400 });
    }

    // 1. Validar propiedad del cupo y que esté aprobado
    const { data: entry, error: entryError } = await supabaseAdmin
      .from('entries')
      .select('user_id, status')
      .eq('id', entryId)
      .single();

    if (entryError || !entry) {
      return new Response(JSON.stringify({ error: 'Cupo no encontrado' }), { status: 404 });
    }

    if (entry.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Acceso denegado a este cupo' }), { status: 403 });
    }

    if (entry.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'El cupo debe estar aprobado para registrar el Pronóstico de Oro' }), { status: 403 });
    }

    // 2. Validar fecha límite de modificaciones (5 minutos antes del primer partido del mundial)
    const { data: firstMatch } = await supabaseAdmin
      .from('matches')
      .select('match_time')
      .order('match_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstMatch) {
      const firstMatchTime = new Date(firstMatch.match_time).getTime();
      const limitTime = firstMatchTime - 5 * 60 * 1000; // 5 minutos antes en ms
      if (Date.now() >= limitTime) {
        return new Response(
          JSON.stringify({ error: 'El Pronóstico de Oro ya se encuentra bloqueado porque faltan menos de 5 minutos para el inicio del mundial.' }),
          { status: 400 }
        );
      }
    }

    // 3. Registrar / Actualizar Pronóstico de Oro en la entrada
    const { error: updateError } = await supabaseAdmin
      .from('entries')
      .update({
        predicted_champion: predictedChampion.trim(),
        predicted_champion_goals: champGoals,
        predicted_final_goals: finalGoals,
      })
      .eq('id', entryId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

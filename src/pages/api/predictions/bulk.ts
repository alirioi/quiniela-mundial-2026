import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const { entryId, predictions } = await request.json();

    if (!entryId || !predictions || !Array.isArray(predictions)) {
      return new Response(JSON.stringify({ error: 'Datos de entrada incompletos o no válidos' }), { status: 400 });
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
      return new Response(JSON.stringify({ error: 'El cupo debe estar aprobado para registrar predicciones' }), { status: 403 });
    }

    // 2. Filtrar predicciones incompletas
    const validPredictions = predictions.filter(
      (p: any) =>
        p.matchId !== undefined &&
        p.predictedHome !== undefined &&
        p.predictedAway !== undefined &&
        p.predictedHome !== '' &&
        p.predictedAway !== ''
    );

    if (validPredictions.length === 0) {
      return new Response(JSON.stringify({ error: 'No se enviaron predicciones válidas para registrar' }), { status: 400 });
    }

    // 3. Realizar Upsert en la base de datos
    // Supabase intentará hacer insert. Si un partido de la lista está a menos de 2 horas de jugarse,
    // el trigger "enforce_prediction_lock" abortará la operación.
    const upsertData = validPredictions.map((p: any) => ({
      entry_id: entryId,
      match_id: p.matchId,
      predicted_home: parseInt(p.predictedHome, 10),
      predicted_away: parseInt(p.predictedAway, 10),
    }));

    const { error: upsertError } = await supabaseAdmin
      .from('predictions')
      .upsert(upsertData, { onConflict: 'entry_id,match_id' });

    if (upsertError) {
      // Capturar si el error es debido al trigger del lock de 2 horas
      if (upsertError.message.includes('2 hours') || upsertError.code === 'P0001') {
        return new Response(
          JSON.stringify({
            error: 'No se pudieron guardar las predicciones. Uno o más partidos de esta lista ya están bloqueados (faltan menos de 2 horas para su inicio).',
          }),
          { status: 400 }
        );
      }
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

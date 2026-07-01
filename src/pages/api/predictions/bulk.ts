export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { requireAuth, validateEntryOwnership } from '../../../utils/api-helpers';

export const POST: APIRoute = async ({ request, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;
  const user = locals.user;

  try {
    const { entryId, predictions } = await request.json();

    if (!entryId || !predictions || !Array.isArray(predictions)) {
      return new Response(JSON.stringify({ error: 'Datos de entrada incompletos o no válidos' }), { status: 400 });
    }

    // 1. Validar propiedad del cupo y que esté aprobado
    const { error: ownershipError } = await validateEntryOwnership(entryId, user.id, 'approved');
    if (ownershipError) return ownershipError;

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
    // Supabase intentará hacer insert. Si un partido de la lista está a menos de 5 minutos de jugarse,
    // el trigger "enforce_prediction_lock" abortará la operación.
    const upsertData = validPredictions.map((p: any) => ({
      entry_id: entryId,
      match_id: p.matchId,
      predicted_home: parseInt(p.predictedHome, 10),
      predicted_away: parseInt(p.predictedAway, 10),
      predicted_winner: p.predictedWinner || null,
    }));

    const { error: upsertError } = await supabaseAdmin
      .from('predictions')
      .upsert(upsertData, { onConflict: 'entry_id,match_id' });

    if (upsertError) {
      // Capturar si el error es debido al trigger del lock de 5 minutos (o 2 horas previo)
      if (
        upsertError.message.includes('5 minutes') ||
        upsertError.message.includes('5 minutos') ||
        upsertError.message.includes('30 minutes') ||
        upsertError.message.includes('30 minutos') ||
        upsertError.message.includes('2 hours') ||
        upsertError.code === 'P0001'
      ) {
        return new Response(
          JSON.stringify({
            error: 'No se pudieron guardar las predicciones. Uno o más partidos de esta lista ya están bloqueados (faltan menos de 5 minutos para su inicio).',
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

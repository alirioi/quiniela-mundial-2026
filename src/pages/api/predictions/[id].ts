export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID de predicción no especificado' }), { status: 400 });
  }

  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const { predictedHome, predictedAway } = await request.json();

    if (predictedHome === undefined || predictedAway === undefined || predictedHome === '' || predictedAway === '') {
      return new Response(JSON.stringify({ error: 'Valores de marcador incompletos' }), { status: 400 });
    }

    // 1. Validar propiedad de la predicción
    const { data: prediction, error: fetchError } = await supabaseAdmin
      .from('predictions')
      .select(`
        entry_id,
        entries (
          user_id
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !prediction) {
      return new Response(JSON.stringify({ error: 'Predicción no encontrada' }), { status: 404 });
    }

    const entryUserId = (prediction as any).entries?.user_id;
    if (entryUserId !== user.id) {
      return new Response(JSON.stringify({ error: 'Acceso denegado a esta predicción' }), { status: 403 });
    }

    // 2. Intentar actualizar la predicción
    // El trigger "enforce_prediction_lock" en Supabase validará que falten >= 30 minutos para el inicio del partido.
    const { error: updateError } = await supabaseAdmin
      .from('predictions')
      .update({
        predicted_home: parseInt(predictedHome, 10),
        predicted_away: parseInt(predictedAway, 10),
      })
      .eq('id', id);

    if (updateError) {
      // Capturar si el error es debido al trigger del lock de 30 minutos (o 2 horas previo)
      if (
        updateError.message.includes('30 minutes') ||
        updateError.message.includes('30 minutos') ||
        updateError.message.includes('2 hours') ||
        updateError.code === 'P0001'
      ) {
        return new Response(
          JSON.stringify({
            error: 'No se pudo guardar la predicción. Este partido ya está bloqueado (faltan menos de 30 minutos para su inicio).',
          }),
          { status: 400 }
        );
      }
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

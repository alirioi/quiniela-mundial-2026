import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  // Explicit admin check
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID de partido no especificado' }), { status: 400 });
  }

  try {
    const { homeScore, awayScore, status } = await request.json();

    const updateData: any = {};
    
    if (homeScore !== undefined && homeScore !== null) {
      updateData.home_score = parseInt(homeScore, 10);
    }
    
    if (awayScore !== undefined && awayScore !== null) {
      updateData.away_score = parseInt(awayScore, 10);
    }

    if (status) {
      if (!['scheduled', 'live', 'finished'].includes(status)) {
        return new Response(JSON.stringify({ error: 'Estado no válido' }), { status: 400 });
      }
      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ error: 'No se enviaron datos para actualizar' }), { status: 400 });
    }

    // Actualizar partido
    const { data: updatedMatch, error } = await supabaseAdmin
      .from('matches')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true, match: updatedMatch }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

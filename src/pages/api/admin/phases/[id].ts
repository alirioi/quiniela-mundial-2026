import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export const PATCH: APIRoute = async ({ params, request }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID de fase no especificado' }), { status: 400 });
  }

  try {
    const { isActive } = await request.json();

    if (isActive === undefined || isActive === null) {
      return new Response(JSON.stringify({ error: 'El campo isActive es obligatorio' }), { status: 400 });
    }

    const { data: updatedPhase, error } = await supabaseAdmin
      .from('tournament_phases')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true, phase: updatedPhase }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

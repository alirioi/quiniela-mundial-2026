import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-server';

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    // Obtener las posiciones de todas las entradas aprobadas ordenadas por puntos descendente
    const { data: standings, error } = await supabaseAdmin
      .from('entries')
      .select('id, display_name, total_points, created_at')
      .eq('status', 'approved')
      .order('total_points', { ascending: false })
      .order('created_at', { ascending: true }); // Desempate por orden de registro

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify(standings), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

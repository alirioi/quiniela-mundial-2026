export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    // 1. Obtener partidos en vivo
    const { data: liveMatches, error: liveError } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('status', 'live')
      .order('match_time', { ascending: true });

    if (liveError) {
      return new Response(JSON.stringify({ error: liveError.message }), { status: 400 });
    }

    let nextMatch = null;

    // 2. Si no hay partidos en vivo, buscar el siguiente programado
    if (!liveMatches || liveMatches.length === 0) {
      const { data: nextData, error: nextError } = await supabaseAdmin
        .from('matches')
        .select('*')
        .eq('status', 'scheduled')
        .gt('match_time', new Date().toISOString())
        .order('match_time', { ascending: true })
        .limit(1);

      if (nextError) {
        return new Response(JSON.stringify({ error: nextError.message }), { status: 400 });
      }

      if (nextData && nextData.length > 0) {
        nextMatch = nextData[0];
      }
    }

    return new Response(JSON.stringify({
      liveMatches: liveMatches || [],
      nextMatch
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Error interno' }), { status: 500 });
  }
};

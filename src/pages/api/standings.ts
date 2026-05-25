export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-server';

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    // 1. Obtener la fecha del primer partido y verificar si hay partidos activos en paralelo
    const [firstMatchRes, activeMatchesRes] = await Promise.all([
      supabaseAdmin
        .from('matches')
        .select('match_time')
        .order('match_time', { ascending: true })
        .limit(1)
        .single(),
      supabaseAdmin
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'scheduled')
    ]);

    const firstMatch = firstMatchRes.data;
    const activeMatchesCount = activeMatchesRes.count;

    const firstMatchTimeStr = firstMatch?.match_time || '2026-06-11T22:30:00Z';
    const firstMatchTime = new Date(firstMatchTimeStr);
    const now = new Date();

    const tournamentStarted = (activeMatchesCount !== null && activeMatchesCount > 0) || now >= firstMatchTime;

    if (!tournamentStarted) {
      return new Response(JSON.stringify({
        tournamentStarted: false,
        firstMatchTime: firstMatchTimeStr,
        standings: []
      }), { status: 200 });
    }

    // 3. Si el torneo ya comenzó, obtener standings
    // Obtener IDs de administradores para excluirlos
    const { data: adminProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin');
    const adminIds = adminProfiles?.map(p => p.id) || [];

    let query = supabaseAdmin
      .from('entries')
      .select('id, display_name, total_points, created_at')
      .eq('status', 'approved')
      .order('total_points', { ascending: false })
      .order('display_name', { ascending: true });

    if (adminIds.length > 0) {
      query = query.not('user_id', 'in', `(${adminIds.join(',')})`);
    }

    const { data: standings, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({
      tournamentStarted: true,
      standings
    }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

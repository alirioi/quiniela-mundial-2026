export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const GET: APIRoute = async () => {
  try {
    const { data: players, error } = await supabaseAdmin
      .from('player_stats')
      .select('*')
      .order('goals', { ascending: false })
      .order('assists', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
    };

    return new Response(JSON.stringify(players), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

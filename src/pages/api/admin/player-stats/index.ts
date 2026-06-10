export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';

// GET all player stats for administration
export const GET: APIRoute = async ({ locals }) => {
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  try {
    const [playersRes, entriesRes] = await Promise.all([
      supabaseAdmin
        .from('player_stats')
        .select('*')
        .order('goals', { ascending: false })
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('entries')
        .select('predicted_champion, profiles!inner(role)')
        .eq('status', 'approved')
        .neq('profiles.role', 'admin')
    ]);

    if (playersRes.error) {
      return new Response(JSON.stringify({ error: playersRes.error.message }), { status: 400 });
    }
    if (entriesRes.error) {
      return new Response(JSON.stringify({ error: entriesRes.error.message }), { status: 400 });
    }

    const counts: Record<string, number> = {};
    entriesRes.data?.forEach((entry: any) => {
      if (entry.predicted_champion) {
        const team = entry.predicted_champion.trim();
        counts[team] = (counts[team] || 0) + 1;
      }
    });

    const goldStats = Object.entries(counts)
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count);

    return new Response(JSON.stringify({
      players: playersRes.data || [],
      goldStats
    }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor', details: e.message }), { status: 500 });
  }
};

// POST to create a new player
export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, team, goals, assists, yellow_cards, red_cards } = body;

    if (!name || !team) {
      return new Response(JSON.stringify({ error: 'El nombre y equipo son obligatorios' }), { status: 400 });
    }

    const { data: player, error } = await supabaseAdmin
      .from('player_stats')
      .insert({
        name,
        team,
        goals: Number(goals) || 0,
        assists: Number(assists) || 0,
        yellow_cards: Number(yellow_cards) || 0,
        red_cards: Number(red_cards) || 0
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify(player), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

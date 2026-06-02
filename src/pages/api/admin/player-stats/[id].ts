export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';

// PATCH to update player statistics
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Falta el ID del jugador' }), { status: 400 });
  }

  try {
    const body = await request.json();
    const { goals, assists, yellow_cards, red_cards } = body;

    const updateFields: any = {
      updated_at: new Date().toISOString()
    };

    if (goals !== undefined) updateFields.goals = Number(goals);
    if (assists !== undefined) updateFields.assists = Number(assists);
    if (yellow_cards !== undefined) updateFields.yellow_cards = Number(yellow_cards);
    if (red_cards !== undefined) updateFields.red_cards = Number(red_cards);

    const { data: player, error } = await supabaseAdmin
      .from('player_stats')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify(player), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

// DELETE a player
export const DELETE: APIRoute = async ({ params, locals }) => {
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Falta el ID del jugador' }), { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('player_stats')
      .delete()
      .eq('id', id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

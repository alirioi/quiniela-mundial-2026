import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-server';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Obtener IDs de administradores para excluirlos
    const { data: adminProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin');
    const adminIds = adminProfiles?.map(p => p.id) || [];

    // Contar las entradas aprobadas excluyendo admins
    let query = supabaseAdmin
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    if (adminIds.length > 0) {
      query = query.not('user_id', 'in', `(${adminIds.join(',')})`);
    }

    const { count, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    const approvedCount = count || 0;
    const prizePoolUsdt = approvedCount * 15; // 15 USDT al pote por cupo de 20 USDT

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
    };

    return new Response(
      JSON.stringify({
        totalPool: prizePoolUsdt,
        approvedEntriesCount: approvedCount,
        breakdown: {
          potPerEntry: 15,
          orgFeePerEntry: 5,
        },
      }),
      { status: 200, headers }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

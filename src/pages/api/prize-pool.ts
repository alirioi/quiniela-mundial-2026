import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-server';

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    // Contar las entradas aprobadas
    const { count, error } = await supabaseAdmin
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    const approvedCount = count || 0;
    const prizePoolUsdt = approvedCount * 15; // 15 USDT al pote por cupo de 20 USDT

    return new Response(
      JSON.stringify({
        totalPool: prizePoolUsdt,
        approvedEntriesCount: approvedCount,
        breakdown: {
          potPerEntry: 15,
          orgFeePerEntry: 5,
        },
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

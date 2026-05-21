import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export const GET: APIRoute = async ({ request }) => {
  try {
    // 1. Obtener todos los cupos y la información del perfil asociada
    const { data: entries, error } = await supabaseAdmin
      .from('entries')
      .select(`
        id,
        user_id,
        entry_number,
        display_name,
        status,
        payment_receipt_url,
        total_points,
        created_at,
        profiles (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    // Generar URLs firmadas para los comprobantes en paralelo (duración: 1 hora)
    const entriesWithSignedUrls = await Promise.all(
      entries.map(async (entry) => {
        if (!entry.payment_receipt_url) {
          return { ...entry, signedUrl: null };
        }
        
        try {
          const { data: signedData } = await supabaseAdmin.storage
            .from('payment-receipts')
            .createSignedUrl(entry.payment_receipt_url, 3600); // 1 hora
            
          return {
            ...entry,
            signedUrl: signedData?.signedUrl || null,
          };
        } catch (e) {
          return { ...entry, signedUrl: null };
        }
      })
    );

    return new Response(JSON.stringify(entriesWithSignedUrls), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID de cupo no especificado' }), { status: 400 });
  }

  try {
    // 1. Obtener la ruta del comprobante
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from('entries')
      .select('payment_receipt_url')
      .eq('id', id)
      .single();

    if (fetchError || !entry) {
      return new Response(JSON.stringify({ error: 'Cupo no encontrado' }), { status: 404 });
    }

    if (!entry.payment_receipt_url) {
      return new Response(JSON.stringify({ error: 'El cupo no tiene un comprobante asociado' }), { status: 400 });
    }

    // 2. Eliminar de Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('payment-receipts')
      .remove([entry.payment_receipt_url]);

    if (storageError) {
      return new Response(JSON.stringify({ error: 'Error al eliminar el archivo del almacenamiento' }), { status: 500 });
    }

    // 3. Actualizar el cupo
    const { error: updateError } = await supabaseAdmin
      .from('entries')
      .update({ payment_receipt_url: null })
      .eq('id', id);

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Error al actualizar el cupo en la base de datos' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

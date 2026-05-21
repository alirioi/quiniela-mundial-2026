import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  let createdEntryId: number | null = null;
  let uploadedFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const displayName = formData.get('displayName') as string;
    const receipt = formData.get('receipt') as File;

    if (!displayName || !receipt) {
      return new Response(JSON.stringify({ error: 'El nombre del cupo y el comprobante son obligatorios' }), { status: 400 });
    }

    // 1. Obtener los cupos existentes para calcular el siguiente número de cupo
    const { data: existingEntries, error: fetchError } = await supabaseAdmin
      .from('entries')
      .select('entry_number')
      .eq('user_id', user.id);

    if (fetchError) {
      return new Response(JSON.stringify({ error: 'Error al consultar tus cupos existentes' }), { status: 500 });
    }

    const nextEntryNumber = existingEntries && existingEntries.length > 0
      ? Math.max(...existingEntries.map((e) => e.entry_number)) + 1
      : 1;

    // 2. Insertar el nuevo cupo con estado 'pending'
    const { data: entryData, error: insertError } = await supabaseAdmin
      .from('entries')
      .insert({
        user_id: user.id,
        entry_number: nextEntryNumber,
        display_name: displayName,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !entryData) {
      return new Response(JSON.stringify({ error: insertError?.message || 'Error al crear el cupo' }), { status: 400 });
    }

    createdEntryId = entryData.id;

    // 3. Subir el comprobante de pago al almacenamiento privado
    const fileExt = receipt.name.split('.').pop() || 'png';
    const filePath = `${user.id}/${nextEntryNumber}/receipt.${fileExt}`;
    uploadedFilePath = filePath;

    const arrayBuffer = await receipt.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await supabaseAdmin.storage
      .from('payment-receipts')
      .upload(filePath, buffer, {
        contentType: receipt.type,
        upsert: true,
      });

    if (storageError) {
      // Rollback: borrar entrada
      await supabaseAdmin.from('entries').delete().eq('id', createdEntryId);
      return new Response(JSON.stringify({ error: 'Error al subir el comprobante de pago' }), { status: 500 });
    }

    // 4. Actualizar la entrada con la ruta del comprobante
    const { error: updateError } = await supabaseAdmin
      .from('entries')
      .update({ payment_receipt_url: filePath })
      .eq('id', createdEntryId);

    if (updateError) {
      // Rollback: borrar archivo y entrada
      await supabaseAdmin.storage.from('payment-receipts').remove([filePath]);
      await supabaseAdmin.from('entries').delete().eq('id', createdEntryId);
      return new Response(JSON.stringify({ error: 'Error al vincular el comprobante con el cupo' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, entry: entryData }), { status: 200 });
  } catch (e) {
    // Rollback general en caso de excepción
    if (uploadedFilePath) {
      try {
        await supabaseAdmin.storage.from('payment-receipts').remove([uploadedFilePath]);
      } catch {}
    }
    if (createdEntryId) {
      try {
        await supabaseAdmin.from('entries').delete().eq('id', createdEntryId);
      } catch {}
    }
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

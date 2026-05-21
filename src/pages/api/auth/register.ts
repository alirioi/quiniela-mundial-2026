import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, cookies }) => {
  let createdUserId: string | null = null;
  let createdEntryId: number | null = null;
  let uploadedFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    const displayName = formData.get('displayName') as string;
    const receipt = formData.get('receipt') as File;

    if (!email || !password || !fullName || !displayName || !receipt) {
      return new Response(JSON.stringify({ error: 'Todos los campos son obligatorios' }), { status: 400 });
    }

    // 1. SignUp user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: authError?.message || 'Error al registrar usuario' }), { status: 400 });
    }

    createdUserId = authData.user.id;

    // 2. Create entry #1 in entries table
    const { data: entryData, error: entryError } = await supabaseAdmin
      .from('entries')
      .insert({
        user_id: createdUserId,
        entry_number: 1,
        display_name: displayName,
        status: 'pending',
      })
      .select()
      .single();

    if (entryError || !entryData) {
      // Cleanup user
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      return new Response(JSON.stringify({ error: entryError?.message || 'Error al crear el cupo' }), { status: 400 });
    }

    createdEntryId = entryData.id;

    // 3. Upload receipt to storage
    const fileExt = receipt.name.split('.').pop() || 'png';
    const filePath = `${createdUserId}/1/receipt.${fileExt}`;
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
      // Cleanup entry and user
      await supabaseAdmin.from('entries').delete().eq('id', createdEntryId);
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      return new Response(JSON.stringify({ error: 'Error al subir el comprobante de pago' }), { status: 500 });
    }

    // 4. Update entry with receipt path
    const { error: updateError } = await supabaseAdmin
      .from('entries')
      .update({ payment_receipt_url: filePath })
      .eq('id', createdEntryId);

    if (updateError) {
      // Cleanup storage, entry, and user
      await supabaseAdmin.storage.from('payment-receipts').remove([filePath]);
      await supabaseAdmin.from('entries').delete().eq('id', createdEntryId);
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      return new Response(JSON.stringify({ error: 'Error al vincular el comprobante con el cupo' }), { status: 500 });
    }

    // 5. Automatically log in if a session is returned on signup
    if (authData.session) {
      const accessToken = authData.session.access_token;
      const refreshToken = authData.session.refresh_token;

      cookies.set('sb-access-token', accessToken, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
      cookies.set('sb-refresh-token', refreshToken, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    // General rollback
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
    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch {}
    }
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

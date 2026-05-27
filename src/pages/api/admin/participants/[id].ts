export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export const DELETE: APIRoute = async ({ params, locals }) => {
  // 1. Validar que el usuario solicitante sea administrador
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID de participante no proporcionado' }), { status: 400 });
  }

  // 2. Evitar que el administrador se elimine a sí mismo
  if (locals.profile.id === id) {
    return new Response(JSON.stringify({ error: 'No puedes eliminar tu propia cuenta' }), { status: 403 });
  }

  try {
    // 3. Obtener todas las entradas del participante para borrar sus comprobantes
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('entries')
      .select('payment_receipt_url')
      .eq('user_id', id);

    if (entriesError) {
      console.error('Error fetching entries for deletion:', entriesError);
      return new Response(JSON.stringify({ error: 'Error al obtener cupos del participante' }), { status: 500 });
    }

    // 4. Eliminar comprobantes de pago de Storage si existen
    if (entries && entries.length > 0) {
      const receiptUrls = entries
        .map((e) => e.payment_receipt_url)
        .filter((url) => url !== null) as string[];

      if (receiptUrls.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from('payment-receipts')
          .remove(receiptUrls);

        if (storageError) {
          console.error('Error deleting receipts from storage:', storageError);
          // Opcional: Podríamos continuar aunque falle el storage, pero es mejor registrar el error.
        }
      }
    }

    // 5. Eliminar entradas (las predicciones se borran en cascada si la BD está configurada así)
    // Si no hay cascada, deberíamos borrar explícitamente las predicciones primero. 
    // Supabase Auth maneja la eliminación en cascada de `public.profiles` si está configurado así, 
    // pero si no, podemos hacerlo manualmente. Lo más seguro es eliminar directamente el usuario
    // de auth.admin, y si hay triggers de cascada, lo borrará de profiles y demás.
    // Sin embargo, para ser explícitos:
    
    // Primero borramos entries (cascade a predictions)
    const { error: deleteEntriesError } = await supabaseAdmin
      .from('entries')
      .delete()
      .eq('user_id', id);
      
    if (deleteEntriesError) {
      console.error('Error deleting entries:', deleteEntriesError);
      return new Response(JSON.stringify({ error: 'Error al eliminar cupos' }), { status: 500 });
    }

    // Borramos el profile explícitamente
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError);
      return new Response(JSON.stringify({ error: 'Error al eliminar perfil público' }), { status: 500 });
    }

    // Finalmente borramos el usuario de auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return new Response(JSON.stringify({ error: 'Error al eliminar cuenta de autenticación' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, message: 'Participante eliminado correctamente' }), { status: 200 });

  } catch (e: any) {
    console.error('Unhandled error in participant deletion:', e);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

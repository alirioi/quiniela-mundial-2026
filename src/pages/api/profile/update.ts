import type { APIRoute } from 'astro';
import { supabaseAdmin, createSupabaseServerClient } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    const supabase = createSupabaseServerClient(accessToken);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401 });
    }

    const body = await request.json();
    const { full_name, phone, birth_date, email, current_password, new_password } = body;

    let emailUpdated = false;

    // 1. Verify current password if user wants to change password
    if (new_password) {
      if (!current_password) {
        return new Response(JSON.stringify({ error: 'Debes ingresar tu contraseña actual.' }), { status: 400 });
      }

      // Try to log in with the current password to verify it
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email as string,
        password: current_password
      });

      if (verifyError) {
        return new Response(JSON.stringify({ error: 'La contraseña actual es incorrecta.' }), { status: 400 });
      }

      // Update password
      const { error: updatePwError } = await supabase.auth.updateUser({
        password: new_password
      });

      if (updatePwError) {
        return new Response(JSON.stringify({ error: 'Error al actualizar la contraseña: ' + updatePwError.message }), { status: 500 });
      }
    }

    // 2. Update Email if changed
    if (email && email !== user.email) {
      const { error: updateEmailError } = await supabase.auth.updateUser({ email });
      if (updateEmailError) {
        return new Response(JSON.stringify({ error: 'Error al actualizar el correo: ' + updateEmailError.message }), { status: 500 });
      }
      emailUpdated = true;
    }

    // 3. Update Profiles Table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: full_name || user.user_metadata?.full_name,
        phone: phone || null,
        birth_date: birth_date || null
      })
      .eq('id', user.id);

    if (profileError) {
      return new Response(JSON.stringify({ error: 'Error al actualizar el perfil en la base de datos.' }), { status: 500 });
    }

    // 4. Update user_metadata in Auth (to keep things synced)
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        full_name: full_name || user.user_metadata?.full_name,
        phone: phone || null,
        birth_date: birth_date || null
      }
    });

    return new Response(JSON.stringify({ success: true, emailUpdated }), { status: 200 });

  } catch (err: any) {
    console.error('Update profile error:', err);
    return new Response(JSON.stringify({ error: 'Error interno del servidor.' }), { status: 500 });
  }
};

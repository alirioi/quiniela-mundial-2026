import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'El correo electrónico es obligatorio' }), { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const redirectTo = `${url.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

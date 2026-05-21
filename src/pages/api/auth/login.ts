import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Falta email o contraseña' }), { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return new Response(JSON.stringify({ error: error?.message || 'Error de autenticación' }), { status: 400 });
    }

    const accessToken = data.session.access_token;
    const refreshToken = data.session.refresh_token;

    // Set session cookies (valid for 7 days or matching session expiration)
    cookies.set('sb-access-token', accessToken, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
    cookies.set('sb-refresh-token', refreshToken, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

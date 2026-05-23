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

    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 30, // 30 días
    };

    cookies.set('sb-access-token', accessToken, cookieOptions);
    cookies.set('sb-refresh-token', refreshToken, cookieOptions);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

export const prerender = false;
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { accessToken, refreshToken } = await request.json();

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'Tokens no válidos' }), { status: 400 });
    }

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

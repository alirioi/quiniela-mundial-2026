import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { accessToken, refreshToken } = await request.json();

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'Tokens no válidos' }), { status: 400 });
    }

    cookies.set('sb-access-token', accessToken, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
    cookies.set('sb-refresh-token', refreshToken, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

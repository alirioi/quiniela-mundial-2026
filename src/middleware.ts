import { defineMiddleware } from 'astro:middleware';
import { supabaseAdmin, createSupabaseServerClient } from './lib/supabase-server';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, locals } = context;
  const path = url.pathname;

  // Define route check helpers
  const isApiRoute = path.startsWith('/api/');
  const isAdminRoute = path.startsWith('/admin') || path.startsWith('/api/admin');
  
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/faq',
    '/forgot-password',
    '/reset-password',
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/reset-password',
    '/api/auth/logout'
  ];

  const isPublicRoute = publicRoutes.includes(path) || (isApiRoute && publicRoutes.some(r => path.startsWith(r)));

  // Get tokens
  let accessToken = cookies.get('sb-access-token')?.value;
  let refreshToken = cookies.get('sb-refresh-token')?.value;

  let user = null;
  let profile = null;
  let entries: any[] = [];
  let isApproved = false;

  if (accessToken) {
    let supabase = createSupabaseServerClient(accessToken);
    let { data, error } = await supabase.auth.getUser();

    if (error && refreshToken) {
      // Access token expired, try to refresh
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (!refreshError && refreshData.session) {
        accessToken = refreshData.session.access_token;
        refreshToken = refreshData.session.refresh_token;

        // Set cookies with secure options
        const cookieOptions = {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax' as const,
          maxAge: 60 * 60 * 24 * 30, // 30 días
        };
        cookies.set('sb-access-token', accessToken, cookieOptions);
        cookies.set('sb-refresh-token', refreshToken, cookieOptions);

        supabase = createSupabaseServerClient(accessToken);
        const { data: userData } = await supabase.auth.getUser();
        user = userData.user;
      }
    } else {
      user = data.user;
    }
  }

  // Fetch profile and entries if authenticated
  if (user) {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    const { data: entriesData, error: entriesError } = await supabaseAdmin
      .from('entries')
      .select('*')
      .eq('user_id', user.id);

    profile = profileData;
    entries = entriesData || [];
    isApproved = entries.some(e => e.status === 'approved');

    // Store in locals for pages and endpoints
    locals.user = user;
    locals.profile = profile;
    locals.entries = entries;
    locals.isApproved = isApproved;
  }

  // REDIRECTION LOGIC
  
  // 1. If not authenticated
  if (!user) {
    if (!isPublicRoute) {
      if (isApiRoute) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
      return redirect('/login');
    }
  } else {
    // Authenticated user

    // 2. Admin protection
    if (isAdminRoute && profile?.role !== 'admin') {
      if (isApiRoute) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
      }
      return redirect('/dashboard');
    }

    // 3. User is pending (no approved entries)
    // Avoid infinite redirect loop for /pending page itself, and allow /my-entries and entries-related APIs
    if (!isApproved && !isPublicRoute && profile?.role !== 'admin' && path !== '/pending' && path !== '/my-entries' && !path.startsWith('/api/auth/') && !path.startsWith('/api/entries/') && !path.startsWith('/api/user/')) {
      if (isApiRoute) {
        return new Response(JSON.stringify({ error: 'Account pending approval' }), { status: 403 });
      }
      return redirect('/pending');
    }

    // 4. Approved user trying to access public auth pages (login, register)
    if (isApproved && (path === '/login' || path === '/register')) {
      return redirect('/dashboard');
    }
  }

  return next();
});

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

const AUTH_PATHS = new Set(['/login', '/register']);
const SUPER_ADMIN_LOGIN_PATH = '/super-admin/login';

export function middleware(request: NextRequest, event: NextFetchEvent) {
  recordPublicProfileView(request, event);
  return handleSession(request);
}

function recordPublicProfileView(request: NextRequest, event: NextFetchEvent): void {
  if (request.method !== 'GET') return;
  const match = /^\/u\/([A-Za-z0-9_-]{3,100})\/?$/.exec(request.nextUrl.pathname);
  const slug = match?.[1];
  if (!slug) return;

  const headers = new Headers();
  for (const name of [
    'x-forwarded-for',
    'cf-connecting-ip',
    'cf-ipcountry',
    'user-agent',
    'dnt',
    'referer',
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
  event.waitUntil(
    fetch(`${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}/view`, {
      method: 'POST',
      headers,
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Public profile view tracking failed (${response.status}).`);
        }
      })
      .catch((error: unknown) => {
        console.error('Could not queue public profile view.', error);
      }),
  );
}

async function handleSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isSuperAdminLogin = path === SUPER_ADMIN_LOGIN_PATH;
  const isProtected =
    path.startsWith('/dashboard') ||
    path.startsWith('/admin') ||
    path === '/preview/profile' ||
    (path.startsWith('/super-admin') && !isSuperAdminLogin);
  const shouldRefreshSession =
    isProtected || isSuperAdminLogin || AUTH_PATHS.has(path) || path === '/';
  if (!shouldRefreshSession) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ message: 'Authentication is not configured.' }, { status: 503 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error && (!error.status || error.status >= 500)) {
    if (isProtected) {
      const destination = request.nextUrl.clone();
      destination.pathname = '/login';
      destination.search = '';
      destination.searchParams.set('next', path);
      destination.searchParams.set('auth_error', 'auth_unavailable');
      const redirect = NextResponse.redirect(destination);
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      return redirect;
    }
    if (AUTH_PATHS.has(path)) return response;
    return NextResponse.json(
      { message: 'Authentication service is unavailable.' },
      { status: 503 },
    );
  }

  if (isProtected && !data.user) {
    const destination = request.nextUrl.clone();
    destination.pathname = '/login';
    destination.searchParams.set('next', path);
    destination.searchParams.set('auth_error', 'missing_session');
    const redirect = NextResponse.redirect(destination);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  if (AUTH_PATHS.has(path) && data.user) {
    const destination = request.nextUrl.clone();
    destination.pathname = '/dashboard';
    destination.search = '';
    const redirect = NextResponse.redirect(destination);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  if (isProtected && path.startsWith('/super-admin')) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return redirectToLogin(request, response);
    try {
      const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
      const roleResponse = await fetch(`${apiUrl}/api/v1/users/me`, {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (roleResponse.status === 401) return redirectToLogin(request, response);
      if (roleResponse.status >= 500) {
        return NextResponse.json(
          { message: 'Authorization is temporarily unavailable.' },
          { status: 503 },
        );
      }
      if (!roleResponse.ok) return redirectToDashboard(request, response);
      const payload: unknown = await roleResponse.json();
      const user =
        typeof payload === 'object' && payload !== null && 'user' in payload
          ? payload.user
          : payload;
      if (
        typeof user !== 'object' ||
        user === null ||
        !('role' in user) ||
        user.role !== 'SUPER_ADMIN'
      ) {
        return redirectToDashboard(request, response);
      }
    } catch {
      return NextResponse.json(
        { message: 'Authorization is temporarily unavailable.' },
        { status: 503 },
      );
    }
  }

  return response;
}

function redirectToLogin(request: NextRequest, response: NextResponse) {
  const destination = request.nextUrl.clone();
  destination.pathname = '/super-admin/login';
  destination.search = '';
  destination.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  const redirect = NextResponse.redirect(destination);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

function redirectToDashboard(request: NextRequest, response: NextResponse) {
  const destination = request.nextUrl.clone();
  destination.pathname = '/dashboard';
  destination.search = '';
  destination.searchParams.set('notice', 'admin-required');
  const redirect = NextResponse.redirect(destination);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

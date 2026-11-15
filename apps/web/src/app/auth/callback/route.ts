import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth_callback', request.url));
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/login?error=auth_callback', request.url));
  }

  const next = request.nextUrl.searchParams.get('next');
  const destination = next === '/reset-password' ? '/reset-password' : '/dashboard';
  return NextResponse.redirect(new URL(destination, request.url));
}

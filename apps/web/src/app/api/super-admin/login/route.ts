import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  superAdminEmailForUsername,
  SuperAdminUsernameSchema,
} from '@/lib/auth/super-admin-username';

const LoginBodySchema = z
  .object({
    username: SuperAdminUsernameSchema,
    password: z.string().min(1).max(128),
  })
  .strict();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  let validOrigin = false;
  if (origin) {
    try {
      validOrigin = new URL(origin).origin === request.nextUrl.origin;
    } catch {
      validOrigin = false;
    }
  }
  if (!validOrigin) {
    return NextResponse.json({ message: 'Invalid username or password.' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid username or password.' }, { status: 400 });
  }
  const parsed = LoginBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid username or password.' }, { status: 400 });
  }

  const now = Date.now();
  const current = attempts.get(parsed.data.username);
  if (current && current.resetAt > now && current.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { message: 'Too many login attempts. Try again later.' },
      { status: 429 },
    );
  }
  if (attempts.size > 1000) {
    for (const [key, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(key);
    }
  }
  attempts.set(
    parsed.data.username,
    current && current.resetAt > now
      ? { count: current.count + 1, resetAt: current.resetAt }
      : { count: 1, resetAt: now + WINDOW_MS },
  );

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: superAdminEmailForUsername(parsed.data.username),
      password: parsed.data.password,
    });
    if (error) {
      return NextResponse.json({ message: 'Invalid username or password.' }, { status: 401 });
    }
    attempts.delete(parsed.data.username);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: 'Invalid username or password.' }, { status: 401 });
  }
}

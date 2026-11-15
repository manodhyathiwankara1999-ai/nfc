import { getSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const CurrentUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.string(),
  accountType: z.string(),
  emailVerified: z.boolean(),
});

const CurrentUserResponseSchema = z.union([
  z.object({ user: CurrentUserSchema }),
  CurrentUserSchema,
]);

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  accountType: string;
  emailVerified: boolean;
}

export class CurrentUserApiError extends Error {
  constructor(readonly statusCode: number) {
    super(`Could not load the current user (${statusCode}).`);
    this.name = 'CurrentUserApiError';
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await getSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError && (!userError.status || userError.status >= 500)) {
    throw new CurrentUserApiError(503);
  }
  if (!userData.user) return null;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new CurrentUserApiError(503);
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new CurrentUserApiError(401);

  const baseUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
  const response = await fetch(`${baseUrl}/api/v1/users/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new CurrentUserApiError(response.status);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CurrentUserApiError(502);
  }
  const parsedResponse = CurrentUserResponseSchema.safeParse(payload);
  if (!parsedResponse.success) throw new CurrentUserApiError(502);

  const result = parsedResponse.data;
  return 'user' in result ? result.user : result;
}

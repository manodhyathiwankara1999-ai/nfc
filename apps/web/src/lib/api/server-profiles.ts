import { PublicCardResponseSchema, PublicProfileResponseSchema } from '@nfc/shared';
import type { PublicCardResponse } from '@nfc/shared';
import type { Profile, PublicProfile, PublicProfileResult } from '@/features/profile/types/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const apiBase = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const supabase = await getSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError && (!userError.status || userError.status >= 500)) {
    throw new Error('Could not verify the Supabase session.');
  }
  if (!userData.user) throw new Error('Authentication is required.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Authentication session is missing.');

  const response = await fetch(`${apiBase}/api/v1${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    throw new Error(`API request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

export function getServerProfile(): Promise<Profile> {
  return request<Profile>('/profiles/me');
}

export async function getServerPublicProfile(slug: string): Promise<PublicProfileResult> {
  const response = await fetch(`${apiBase}/api/v1/public/profiles/${encodeURIComponent(slug)}`, {
    next: { revalidate: 300, tags: [`profile:${slug}`] },
  });
  if (response.status === 404) return { kind: 'not-found' };
  if (!response.ok) throw new Error(`Public profile request failed (${response.status}).`);
  const parsed = PublicProfileResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('Public profile API returned an invalid response.');
  if (parsed.data.kind === 'redirect') return parsed.data;
  return { kind: 'profile', profile: parsed.data.profile };
}

export async function getServerPublicCard(slug: string): Promise<PublicCardResponse | null> {
  const response = await fetch(`${apiBase}/api/v1/public/cards/${encodeURIComponent(slug)}`, {
    next: { revalidate: 300, tags: [`profile:${slug}`] },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public card request failed (${response.status}).`);
  const parsed = PublicCardResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('Public card API returned an invalid response.');
  return parsed.data;
}

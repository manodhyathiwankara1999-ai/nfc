import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly requestId: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_PREFIX = '/api/v1';

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
  if (sessionError) throw sessionError;

  const headers = new Headers(init.headers);
  if (data.session) headers.set('authorization', `Bearer ${data.session.access_token}`);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      error?.message ?? 'The request could not be completed.',
      response.status,
      error?.code ?? 'API_ERROR',
      error?.requestId ?? '',
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

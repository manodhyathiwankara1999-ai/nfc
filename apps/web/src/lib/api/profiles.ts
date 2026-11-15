import type { Profile, ProfileUpdate } from '@/features/profile/types/profile';
import { apiRequest } from './client';

export function getMyProfile(): Promise<Profile> {
  return apiRequest<Profile>('/profiles/me');
}

export function updateMyProfile(patch: ProfileUpdate): Promise<Profile> {
  return apiRequest<Profile>('/profiles/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

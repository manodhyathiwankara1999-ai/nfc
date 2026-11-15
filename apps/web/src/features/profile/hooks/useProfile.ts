'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyProfile, updateMyProfile } from '@/lib/api/profiles';
import { getGallery, type GalleryEntry } from '@/lib/api/uploads';
import type { Profile, ProfileUpdate } from '../types/profile';

export const PROFILE_QUERY_KEY = ['profile', 'me'];
export const GALLERY_QUERY_KEY = ['profile', 'gallery'];

export function useProfile(initial?: Profile) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: getMyProfile,
    initialData: initial,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfileUpdate) => updateMyProfile(patch),
    onSuccess: (profile) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, profile);
      queryClient.invalidateQueries({ queryKey: ['profile', 'public'] });
    },
  });
}

export function useGallery() {
  return useQuery<GalleryEntry[]>({ queryKey: GALLERY_QUERY_KEY, queryFn: getGallery });
}

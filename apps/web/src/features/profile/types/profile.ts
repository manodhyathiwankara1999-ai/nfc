import type { ProfileDataUpdate, PublicProfileApi } from '@nfc/shared';

export interface Profile {
  id: string;
  userId: string;
  slug: string;
  fullName: string | null;
  jobTitle: string | null;
  skillsLine: string | null;
  tagline: string | null;
  avatar: string | null;
  coverImage: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  website: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  themeColor: string;
  profileType: string;
  isPublic: boolean;
  isIndexable: boolean;
}

export type PublicProfile = PublicProfileApi;

export type PublicProfileResult =
  | { kind: 'profile'; profile: PublicProfile }
  | { kind: 'redirect'; slug: string }
  | { kind: 'not-found' };

export type ProfileUpdate = ProfileDataUpdate & {
  slug?: string;
  isPublic?: boolean;
  isIndexable?: boolean;
};

import { z } from 'zod';

export const PROFILE_TEMPLATE_IDS = ['editorial', 'liquid-glass'] as const;

export type ProfileTemplateId = (typeof PROFILE_TEMPLATE_IDS)[number];

export const ProfileTemplateIdSchema = z.enum(PROFILE_TEMPLATE_IDS);
export const ProfileTemplateSelectionSchema = ProfileTemplateIdSchema.nullable();

export const PROFILE_TEMPLATE_OPTIONS = [
  {
    id: null,
    name: 'Default',
    description: 'Keep the current portfolio design.',
    thumbnail: '/templates/default.svg',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'A clean, typographic layout with a focused profile header.',
    thumbnail: '/templates/editorial.svg',
  },
  {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    description: 'A luminous, softly frosted glass profile.',
    thumbnail: '/templates/liquid-glass.svg',
  },
] as const satisfies readonly {
  id: ProfileTemplateId | null;
  name: string;
  description: string;
  thumbnail: string;
}[];

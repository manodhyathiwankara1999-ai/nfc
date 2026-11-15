import { z } from 'zod';
import {
  ProfileDataFieldsSchema,
  ProfileSlugSchema,
  validateProfileSocialUrls,
} from './profile-data';

export const ProfileUpdateApiSchema = z
  .object({
    isPublic: z.boolean().optional(),
    isIndexable: z.boolean().optional(),
    slug: ProfileSlugSchema.optional(),
    fullName: ProfileDataFieldsSchema.shape.fullName.optional(),
    jobTitle: ProfileDataFieldsSchema.shape.jobTitle,
    skillsLine: ProfileDataFieldsSchema.shape.skillsLine,
    tagline: ProfileDataFieldsSchema.shape.tagline,
    avatar: ProfileDataFieldsSchema.shape.avatar,
    coverImage: ProfileDataFieldsSchema.shape.coverImage,
    phone: ProfileDataFieldsSchema.shape.phone,
    email: ProfileDataFieldsSchema.shape.email,
    location: ProfileDataFieldsSchema.shape.location,
    website: ProfileDataFieldsSchema.shape.website,
    linkedinUrl: ProfileDataFieldsSchema.shape.linkedinUrl,
    githubUrl: ProfileDataFieldsSchema.shape.githubUrl,
    themeColor: ProfileDataFieldsSchema.shape.themeColor.optional(),
  })
  .superRefine(validateProfileSocialUrls);

export type ProfileUpdateApi = z.infer<typeof ProfileUpdateApiSchema>;

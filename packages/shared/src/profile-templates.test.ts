import { describe, expect, it } from 'vitest';
import {
  PROFILE_TEMPLATE_IDS,
  ProfileTemplateIdSchema,
  ProfileTemplateSelectionSchema,
} from './profile-templates';

describe('profile template identifiers', () => {
  it('accepts each registered template and null for Default', () => {
    for (const id of PROFILE_TEMPLATE_IDS) {
      expect(ProfileTemplateIdSchema.parse(id)).toBe(id);
      expect(ProfileTemplateSelectionSchema.parse(id)).toBe(id);
    }
    expect(ProfileTemplateSelectionSchema.parse(null)).toBeNull();
  });

  it('rejects unknown template identifiers', () => {
    expect(ProfileTemplateSelectionSchema.safeParse('unregistered').success).toBe(false);
  });
});

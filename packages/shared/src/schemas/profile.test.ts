import { describe, expect, it } from 'vitest';
import { AccountType } from '../enums';
import { ProfileSchema, SlugSchema } from './profile';

describe('SlugSchema', () => {
  it.each(['ada', 'ada-lovelace', 'user-42'])('accepts %s', (slug) => {
    expect(SlugSchema.safeParse(slug).success).toBe(true);
  });

  it.each(['', '-ada', 'Ada', 'ada--lovelace', 'ada_42'])('rejects %s', (slug) => {
    expect(SlugSchema.safeParse(slug).success).toBe(false);
  });
});

describe('ProfileSchema', () => {
  it('validates the profile persistence shape', () => {
    expect(
      ProfileSchema.safeParse({
        id: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
        user_id: 'd9428888-122b-11e1-b85c-61cd3cbb3211',
        slug: 'ada-lovelace',
        display_name: 'Ada Lovelace',
        title: null,
        bio: null,
        avatar_url: null,
        profile_type: AccountType.PERSONAL,
        is_public: true,
        theme: {},
        created_at: '2026-10-04T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});

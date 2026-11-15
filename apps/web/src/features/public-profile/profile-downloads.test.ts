import { describe, expect, it } from 'vitest';
import type { PublicProfile } from '@/features/profile/types/profile';
import { createProfileCsv, createProfileVCard, escapeCsvCell } from './profile-downloads';

const profile: PublicProfile = {
  slug: 'ada-lovelace',
  fullName: 'Ada Lovelace',
  jobTitle: 'Engineer',
  skillsLine: 'TypeScript | ERP',
  tagline: 'Building',
  avatar: null,
  coverImage: null,
  phone: '+94771234567',
  email: 'ada@example.com',
  location: 'Colombo',
  website: 'https://example.com',
  linkedinUrl: 'https://linkedin.com/in/ada',
  githubUrl: 'https://github.com/ada',
  socialLinks: [],
  galleryImages: [],
  themeColor: '#4f46e5',
  templateId: null,
  isIndexable: true,
};

describe('profile downloads', () => {
  it('escapes CSV quotes and prevents formula injection', () => {
    expect(escapeCsvCell('=1+1')).toBe('"\'=1+1"');
    expect(escapeCsvCell('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
    expect(escapeCsvCell('Name, "title"')).toBe('"Name, ""title"""');
  });

  it('generates CSV from available profile fields', () => {
    const csv = createProfileCsv(profile, 'https://cards.example/u/ada-lovelace');

    expect(csv).toContain('"Full name","Ada Lovelace"');
    expect(csv).toContain('"Email","ada@example.com"');
    expect(csv).toContain('"Profile URL","https://cards.example/u/ada-lovelace"');
  });

  it('generates an escaped vCard from the same data', () => {
    const vcard = createProfileVCard(
      { ...profile, fullName: 'Ada, Lovelace; PhD' },
      'https://cards.example/u/ada-lovelace',
    );

    expect(vcard).toContain('FN:Ada\\, Lovelace\\; PhD\r\n');
    expect(vcard).toContain('TEL;TYPE=CELL:+94771234567');
    expect(vcard).toContain('EMAIL:ada@example.com');
    expect(vcard).toContain('END:VCARD\r\n');
  });
});

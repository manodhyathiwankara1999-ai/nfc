import { describe, expect, it } from 'vitest';
import { parseProfilePreviewMessage } from './profile-preview-message';

const source = {};
const previewData = {
  profile: {
    slug: 'ada-lovelace',
    fullName: 'Ada Lovelace',
    jobTitle: null,
    skillsLine: null,
    tagline: null,
    avatar: null,
    coverImage: null,
    phone: null,
    email: null,
    location: null,
    website: null,
    linkedinUrl: null,
    githubUrl: null,
    galleryImages: [],
    themeColor: '#4f46e5',
    isIndexable: false,
  },
  office: null,
  products: [],
  showProducts: false,
};

describe('parseProfilePreviewMessage', () => {
  it('accepts a valid message from the expected iframe origin and source', () => {
    expect(
      parseProfilePreviewMessage(
        {
          origin: 'https://app.example.com',
          source,
          data: { type: 'profile-preview-ready' },
        },
        'https://app.example.com',
        source,
      ),
    ).toEqual({ type: 'profile-preview-ready' });
  });

  it('accepts a valid draft profile payload', () => {
    expect(
      parseProfilePreviewMessage(
        {
          origin: 'https://app.example.com',
          source,
          data: { type: 'profile-preview-data', payload: previewData },
        },
        'https://app.example.com',
        source,
      ),
    ).toMatchObject({
      type: 'profile-preview-data',
      payload: { profile: { fullName: 'Ada Lovelace' } },
    });
  });

  it('rejects invalid messages and messages from another origin or window', () => {
    expect(
      parseProfilePreviewMessage(
        {
          origin: 'https://app.example.com',
          source,
          data: { type: 'profile-preview-data', payload: {} },
        },
        'https://app.example.com',
        source,
      ),
    ).toBeNull();
    expect(
      parseProfilePreviewMessage(
        {
          origin: 'https://evil.example',
          source,
          data: { type: 'profile-preview-ready' },
        },
        'https://app.example.com',
        source,
      ),
    ).toBeNull();
    expect(
      parseProfilePreviewMessage(
        {
          origin: 'https://app.example.com',
          source: {},
          data: { type: 'profile-preview-ready' },
        },
        'https://app.example.com',
        source,
      ),
    ).toBeNull();
  });
});

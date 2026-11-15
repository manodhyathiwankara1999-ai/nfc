import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PublicProfile } from '@/features/profile/types/profile';
import DefaultTemplate from '../templates/default/DefaultTemplate';
import { createProfileTemplateViewModel } from '../templates/view-model';

const profile: PublicProfile = {
  slug: 'ada-lovelace',
  fullName: 'Ada Lovelace',
  jobTitle: 'Engineer',
  skillsLine: 'TypeScript | Systems',
  tagline: 'Building useful software',
  avatar: null,
  coverImage: null,
  phone: '+94771234567',
  email: 'ada@example.com',
  location: 'Colombo',
  website: null,
  linkedinUrl: null,
  githubUrl: null,
  socialLinks: [],
  galleryImages: [],
  themeColor: '#4f46e5',
  templateId: null,
  isIndexable: true,
};

const actions = {
  downloadContact: () => undefined,
  downloadCsv: () => undefined,
  qrDataUrl: '',
  qrError: '',
};

function renderProfile(
  selected: PublicProfile,
  office: Parameters<typeof createProfileTemplateViewModel>[1] = null,
  products: Parameters<typeof createProfileTemplateViewModel>[2] = [],
  showProducts = false,
) {
  const viewModel = createProfileTemplateViewModel(selected, office, products, showProducts);
  return renderToStaticMarkup(createElement(DefaultTemplate, { viewModel, actions }));
}

describe('public profile mobile layout', () => {
  it('renders the single-column mobile structure with valid contact actions', () => {
    const markup = renderProfile(profile);

    expect(markup).toContain('sm:grid-cols-2');
    expect(markup).toContain('sm:grid-cols-2');
    expect(markup).toContain('Download Contact');
    expect(markup).toContain('href="tel:+94771234567"');
    expect(markup).toContain('href="mailto:ada@example.com"');
    expect(markup).toContain('>Contact</h2>');
    expect(markup).not.toContain('id="gallery"');
  });

  it('uses the two-column tablet and desktop sidebar breakpoints', () => {
    const markup = renderProfile(profile);

    expect(markup).toContain('sm:grid-cols-2');
    expect(markup).toContain('max-w-[1080px]');
    expect(markup).toContain('max-w-4xl');
  });

  it('omits empty contact cards and social navigation', () => {
    const noContact: PublicProfile = {
      ...profile,
      phone: null,
      email: null,
      location: null,
      website: null,
      linkedinUrl: null,
      githubUrl: null,
    };
    const markup = renderProfile(noContact);

    expect(markup).not.toContain('>Contact</h2>');
    expect(markup).not.toContain('Social profiles');
  });

  it('renders the required sections in order and includes all social links', () => {
    const markup = renderProfile(
      {
        ...profile,
        galleryImages: [
          { url: 'https://cdn.example.com/gallery.webp', alt: 'Gallery photo', caption: null },
        ],
        socialLinks: [
          { platform: 'INSTAGRAM', url: 'https://instagram.com/ada' },
          { platform: 'LINKEDIN', url: 'https://linkedin.com/in/ada' },
        ],
      },
      {
        hasOffice: true,
        companyName: 'Analytical Engine Ltd.',
        designation: null,
        department: null,
        officeAddress: null,
        officePhone: null,
        officeEmail: null,
        companyWebsite: null,
        workingHours: null,
      },
    );
    const sectionOrder = [
      'Building useful software',
      'Ada Lovelace',
      'Open Instagram profile',
      'Download Contact',
      '>Contact</h2>',
      '>QR code</h2>',
      'Analytical Engine Ltd.',
      'Quick Links',
      'Gallery',
    ].map((text) => markup.indexOf(text));

    expect(sectionOrder.every((index) => index >= 0)).toBe(true);
    expect(sectionOrder).toEqual([...sectionOrder].sort((left, right) => left - right));
  });
});

import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_TEMPLATE_IDS,
  type CardOffice,
  type CardProductResponse,
  type PublicProfileApi,
} from '@nfc/shared';
import type { PublicProfileTemplateProps } from './contract';
import DefaultTemplate from './default/DefaultTemplate';
import EditorialTemplate from './editorial/EditorialTemplate';
import { createProfileTemplateViewModel } from './view-model';
import { resolveTemplateComponent } from './registry';

const profile: PublicProfileApi = {
  slug: 'ada-lovelace',
  fullName: 'Ada Lovelace',
  jobTitle: 'Engineer',
  skillsLine: 'TypeScript | Systems',
  tagline: 'Building useful software',
  avatar: 'https://cdn.example.com/avatar.webp',
  coverImage: 'https://cdn.example.com/cover.webp',
  phone: '+94771234567',
  email: 'ada@example.com',
  location: 'Colombo',
  website: 'https://example.com',
  linkedinUrl: 'https://linkedin.com/in/ada',
  githubUrl: 'https://github.com/ada',
  socialLinks: [{ platform: 'INSTAGRAM', url: 'https://instagram.com/ada' }],
  galleryImages: [
    { url: 'https://cdn.example.com/gallery.webp', alt: 'Gallery work', caption: 'Work sample' },
  ],
  themeColor: '#4f46e5',
  templateId: null,
  isIndexable: false,
};

const office: CardOffice = {
  hasOffice: true,
  companyName: 'Analytical Engine Ltd.',
  designation: 'Lead Engineer',
  department: 'Research',
  officeAddress: 'Colombo',
  officePhone: '+94771234567',
  officeEmail: 'office@example.com',
  companyWebsite: 'https://example.com',
  workingHours: 'Weekdays',
};

const product: CardProductResponse = {
  id: 'product-1',
  sortOrder: 0,
  image: 'https://cdn.example.com/product.webp',
  name: 'Engine',
  price: 12.5,
  currency: 'USD',
  detail: 'A precision engine.',
};
const products = [product];

const actions = {
  downloadContact: () => undefined,
  downloadCsv: () => undefined,
  qrDataUrl: '',
  qrError: '',
};

const templates: Array<{
  id: string;
  component: ComponentType<PublicProfileTemplateProps>;
}> = [
  { id: 'default', component: DefaultTemplate },
  { id: 'editorial', component: EditorialTemplate },
];

const cases: Array<{
  label: string;
  profile: PublicProfileApi;
  office: CardOffice | null;
  products: CardProductResponse[];
  showProducts: boolean;
}> = [
  { label: 'full data', profile, office, products, showProducts: true },
  {
    label: 'minimal data',
    profile: {
      ...profile,
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
      socialLinks: [],
      galleryImages: [],
    },
    office: null,
    products: [],
    showProducts: false,
  },
  { label: 'no office', profile, office: null, products, showProducts: true },
  { label: 'no products', profile, office, products: [], showProducts: false },
  {
    label: 'product without a price',
    profile,
    office: null,
    products: [{ ...product, price: undefined }],
    showProducts: true,
  },
  {
    label: 'very long text',
    profile: { ...profile, fullName: 'A'.repeat(100), tagline: 'B'.repeat(120) },
    office: null,
    products: [],
    showProducts: false,
  },
  {
    label: 'missing optional profile images',
    profile: { ...profile, avatar: null, coverImage: null, galleryImages: [] },
    office: null,
    products: [],
    showProducts: false,
  },
];

describe('public profile template contract', () => {
  it('keeps every shared template id registered and unknown ids resolve to Default', () => {
    expect(templates.map(({ id }) => id)).toEqual(['default', ...PROFILE_TEMPLATE_IDS]);
    expect(resolveTemplateComponent('unknown').id).toBeNull();
    expect(resolveTemplateComponent('editorial').id).toBe('editorial');
  });

  it.each(cases)('renders $label with each registered template', (testCase) => {
    const viewModel = createProfileTemplateViewModel(
      testCase.profile,
      testCase.office,
      testCase.products,
      testCase.showProducts,
    );
    for (const { component: Template } of templates) {
      const markup = renderToStaticMarkup(createElement(Template, { viewModel, actions }));
      expect(markup).toContain(viewModel.profile.fullName);
      expect(markup).not.toContain('undefined');
      if (viewModel.sections.office) expect(markup).toContain('Office');
      if (viewModel.sections.products) expect(markup).toContain('Engine');
      if (viewModel.products[0]?.price === undefined) expect(markup).not.toContain('USD 12.5');
    }
  });
});

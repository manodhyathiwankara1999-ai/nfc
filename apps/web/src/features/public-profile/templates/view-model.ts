import {
  generateProfileThemePalette,
  type CardOffice,
  type CardProductResponse,
  type PublicProfileApi,
} from '@nfc/shared';
import type { ProfileTemplateViewModel } from './contract';

export function createProfileTemplateViewModel(
  profile: PublicProfileApi,
  office: CardOffice | null,
  products: CardProductResponse[],
  showProducts: boolean,
): ProfileTemplateViewModel {
  const visibleOffice = office?.hasOffice ? office : null;
  const visibleProducts = showProducts ? products.slice(0, 5) : [];
  const socialLinks = profile.socialLinks.length
    ? profile.socialLinks
    : [
        ...(profile.linkedinUrl
          ? [{ platform: 'LINKEDIN' as const, url: profile.linkedinUrl }]
          : []),
        ...(profile.githubUrl ? [{ platform: 'GITHUB' as const, url: profile.githubUrl }] : []),
      ];

  return {
    profile,
    palette: generateProfileThemePalette(profile.themeColor),
    office: visibleOffice,
    products: visibleProducts,
    socialLinks,
    sections: {
      contact: Boolean(profile.phone || profile.email || profile.location || profile.website),
      social: socialLinks.length > 0 || Boolean(profile.email),
      gallery: profile.galleryImages.length > 0,
      office: visibleOffice !== null,
      products: visibleProducts.length > 0,
    },
  };
}

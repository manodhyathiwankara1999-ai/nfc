import type { CardOffice, CardProductResponse, PublicProfileApi } from '@nfc/shared';
import type { PublicProfile } from '@/features/profile/types/profile';

export type ResponsiveFixtureName = 'full' | 'stress' | 'minimal';

export interface ResponsiveProfileFixture {
  profile: PublicProfile;
  office: CardOffice;
  products: CardProductResponse[];
  showProducts: boolean;
}

const squareImage = createSvgDataUrl(640, 640, '#dbeafe');
const landscapeImage = createSvgDataUrl(640, 480, '#dcfce7');
const coverImage = createSvgDataUrl(1280, 420, '#ede9fe');
const longText = 'UnbrokenResponsiveTestWord'.repeat(8);

export function createResponsiveProfileFixture(
  name: ResponsiveFixtureName,
  templateId: PublicProfileApi['templateId'],
): ResponsiveProfileFixture {
  const isMinimal = name === 'minimal';
  const isStress = name === 'stress';
  const profile: PublicProfile = {
    slug: 'responsive-contract',
    fullName: isStress ? longText : 'Taylor Example',
    jobTitle: isMinimal ? null : 'Product designer',
    skillsLine: isMinimal ? null : 'Design systems, research, prototyping',
    tagline: isMinimal
      ? null
      : isStress
        ? longText
        : 'Thoughtful digital experiences, from idea to launch.',
    avatar: isStress || isMinimal ? null : squareImage,
    coverImage: isStress || isMinimal ? null : coverImage,
    phone: isMinimal ? null : '+94771234567',
    email: isMinimal
      ? null
      : isStress
        ? `${'longlocalpart'.repeat(5)}@example.com`
        : 'taylor@example.com',
    location: isMinimal ? null : isStress ? longText : 'Colombo, Sri Lanka',
    website: isMinimal ? null : `https://example.com/${isStress ? longText : 'portfolio'}`,
    linkedinUrl: isMinimal ? null : 'https://linkedin.com/in/taylor-example',
    githubUrl: isMinimal ? null : null,
    socialLinks: isMinimal
      ? []
      : [{ platform: 'INSTAGRAM', url: 'https://instagram.com/taylor-example' }],
    galleryImages: isMinimal
      ? []
      : Array.from({ length: isStress ? 5 : 3 }, (_, index) => ({
          url: squareImage,
          alt: `Portfolio image ${index + 1}`,
          caption: `Work sample ${index + 1}`,
        })),
    themeColor: '#4f46e5',
    templateId,
    isIndexable: false,
  };

  const office: CardOffice = {
    hasOffice: !isMinimal,
    companyName: isStress ? longText : 'Example Studio',
    designation: isStress ? longText : 'Creative director',
    department: isStress ? longText : 'Design',
    officeAddress: isStress ? longText : '100 Example Road, Colombo',
    officePhone: isMinimal ? null : '+94112345678',
    officeEmail: isStress ? `${'officelocalpart'.repeat(5)}@example.com` : 'office@example.com',
    companyWebsite: isMinimal ? null : `https://example.com/${isStress ? longText : 'studio'}`,
    workingHours: isStress ? longText : 'Monday to Friday, 9am–5pm',
  };
  const products = isMinimal
    ? []
    : Array.from(
        { length: 5 },
        (_, index): CardProductResponse => ({
          id: `responsive-product-${index + 1}`,
          sortOrder: index,
          image: landscapeImage,
          name: isStress ? `${longText}-${index + 1}` : `Service ${index + 1}`,
          price: isStress && index % 2 === 0 ? undefined : index + 10,
          currency: 'USD',
          detail: isStress ? longText : `A sample service description ${index + 1}.`,
        }),
      );

  return { profile, office, products, showProducts: !isMinimal };
}

function createSvgDataUrl(width: number, height: number, fill: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

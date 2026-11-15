import type { Metadata } from 'next';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { getServerPublicCard } from '@/lib/api/server-profiles';
import { ProfileView } from '@/features/public-profile/components/ProfileView';
import type { CardProfileData, PublicProfileApi } from '@nfc/shared';

export async function generateProfileMetadata(slug: string): Promise<Metadata> {
  const card = await getServerPublicCard(slug);
  if (!card) return { title: 'Profile not found' };
  if (card.status === 'inactive') {
    return {
      title: card.name,
      description: 'This card is currently inactive.',
      robots: { index: false, follow: false },
    };
  }
  const profile = toPublicProfile(card.slug, card.profile);
  return {
    title: profile.fullName,
    description: profile.tagline ?? profile.jobTitle ?? undefined,
    robots: profile.isIndexable ? undefined : { index: false, follow: false },
    openGraph: {
      title: profile.fullName,
      description: profile.tagline ?? profile.jobTitle ?? undefined,
      type: 'profile',
      images: profile.avatar ? [{ url: profile.avatar }] : undefined,
    },
  };
}

export async function PublicProfilePage({ params }: { params: { slug: string } }) {
  const card = await getServerPublicCard(params.slug);
  if (!card) notFound();
  if (card.status === 'inactive') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">{card.name}</h1>
          <p className="mt-3 text-slate-600">This card is currently inactive</p>
        </section>
      </main>
    );
  }
  const profile = toPublicProfile(card.slug, card.profile);
  return (
    <ProfileView
      profile={profile}
      office={card.office}
      products={card.products}
      showProducts={card.profile.showProducts}
    />
  );
}

function toPublicProfile(slug: string, profile: CardProfileData): PublicProfileApi {
  const link = (platform: CardProfileData['socialLinks'][number]['platform']) =>
    profile.socialLinks.find((item) => item.platform === platform)?.url ?? null;
  return {
    slug,
    fullName: profile.fullName,
    jobTitle: profile.jobTitle ?? null,
    skillsLine: profile.skillsLine ?? null,
    tagline: profile.tagline ?? null,
    avatar: profile.avatar ?? null,
    coverImage: profile.cover ?? null,
    phone: profile.contact.phone ?? null,
    email: profile.contact.email
      ? (z.string().email().safeParse(profile.contact.email).data ?? null)
      : null,
    location: profile.contact.location ?? null,
    website: profile.contact.website ?? null,
    linkedinUrl: link('LINKEDIN'),
    githubUrl: link('GITHUB'),
    galleryImages: profile.gallery.map((url) => ({ url, alt: '', caption: null })),
    themeColor: profile.themeColor,
    templateId: profile.templateId,
    isIndexable: false,
    socialLinks: profile.socialLinks,
  };
}

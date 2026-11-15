import type { Metadata } from 'next';
import {
  generateProfileMetadata,
  PublicProfilePage,
} from '@/features/public-profile/components/PublicProfilePage';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return generateProfileMetadata((await params).slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <PublicProfilePage params={await params} />;
}

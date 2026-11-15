import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProfileView } from '@/features/public-profile/components/ProfileView';
import {
  createResponsiveProfileFixture,
  type ResponsiveFixtureName,
} from '@/features/public-profile/templates/responsive-fixtures';
import { ProfileTemplateSelectionSchema } from '@nfc/shared';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profile template responsive contract',
  robots: { index: false, follow: false },
};

export default async function ProfileTemplateContractPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; fixture?: string }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();

  const { template, fixture } = await searchParams;
  const templateId = template === 'default' ? null : template;
  if (!isResponsiveFixtureName(fixture)) notFound();
  const parsedTemplateId = ProfileTemplateSelectionSchema.safeParse(templateId);
  if (!parsedTemplateId.success) notFound();

  const data = createResponsiveProfileFixture(fixture, parsedTemplateId.data);
  return (
    <div data-template-contract={`${template}-${fixture}`}>
      <ProfileView
        profile={data.profile}
        office={data.office}
        products={data.products}
        showProducts={data.showProducts}
      />
    </div>
  );
}

function isResponsiveFixtureName(value: string | undefined): value is ResponsiveFixtureName {
  return value === 'full' || value === 'stress' || value === 'minimal';
}

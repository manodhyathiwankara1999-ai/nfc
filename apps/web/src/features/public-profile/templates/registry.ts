import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { PROFILE_TEMPLATE_IDS, ProfileTemplateSelectionSchema } from '@nfc/shared';
import type { PublicProfileTemplateProps } from './contract';
import { editorialTemplateManifest } from './editorial/manifest';
import { liquidGlassTemplateManifest } from './liquid-glass/manifest';

export const DefaultTemplateComponent = dynamic<PublicProfileTemplateProps>(
  () => import('./default/DefaultTemplate'),
  { ssr: true },
);

export const registeredTemplateComponents = {
  editorial: dynamic<PublicProfileTemplateProps>(() => import('./editorial/EditorialTemplate'), {
    ssr: true,
  }),
  'liquid-glass': dynamic<PublicProfileTemplateProps>(
    () => import('./liquid-glass/LiquidGlassTemplate'),
    { ssr: true },
  ),
} satisfies Record<
  (typeof PROFILE_TEMPLATE_IDS)[number],
  ComponentType<PublicProfileTemplateProps>
>;

export const registeredTemplateManifests = {
  editorial: editorialTemplateManifest,
  'liquid-glass': liquidGlassTemplateManifest,
} satisfies Record<
  (typeof PROFILE_TEMPLATE_IDS)[number],
  {
    id: (typeof PROFILE_TEMPLATE_IDS)[number];
    name: string;
    description: string;
    thumbnail: string;
  }
>;

export function resolveTemplateComponent(templateId: unknown) {
  const parsed = ProfileTemplateSelectionSchema.safeParse(templateId);
  if (!parsed.success || parsed.data === null) {
    return { id: null, component: DefaultTemplateComponent };
  }
  return {
    id: parsed.data,
    component: registeredTemplateComponents[parsed.data],
  };
}

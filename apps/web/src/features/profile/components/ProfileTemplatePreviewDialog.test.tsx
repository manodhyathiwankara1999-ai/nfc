import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileTemplatePreviewDialog } from './ProfileTemplatePreviewDialog';

describe('ProfileTemplatePreviewDialog', () => {
  it('starts on mobile and exposes the responsive device and template actions', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileTemplatePreviewDialog, {
        templateName: 'Editorial',
        data: null,
        missingPhotos: true,
        onClose: () => undefined,
        onUseTemplate: () => undefined,
        onAddPhotos: () => undefined,
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('Mobile (390)');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('Tablet (820)');
    expect(markup).toContain('Desktop (1280)');
    expect(markup).toContain('Add a photo to see it at its best');
    expect(markup).toContain('Use this template');
    expect(markup).toContain('Close</button>');
  });
});

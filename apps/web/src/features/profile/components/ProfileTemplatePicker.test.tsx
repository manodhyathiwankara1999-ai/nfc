import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileTemplatePicker } from './ProfileTemplatePicker';

describe('ProfileTemplatePicker', () => {
  it('shows Default and available template details and marks the selected card', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileTemplatePicker, {
        value: 'editorial',
        savedValue: null,
        onChange: () => undefined,
        previewData: null,
        hasAvatar: false,
        hasCover: false,
        onGoToImages: () => undefined,
      }),
    );

    expect(markup).toContain('Default');
    expect(markup).toContain('Editorial');
    expect(markup).toContain('current portfolio design');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('>Preview</button>');
    expect(markup).toContain('Saved template: Default');
    expect(markup).toContain('Previewing: Editorial (not saved)');
    expect(markup).toContain('/templates/editorial.svg');
  });

  it('moves the saved badge when the server value updates after a successful save', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileTemplatePicker, {
        value: 'editorial',
        savedValue: 'editorial',
        onChange: () => undefined,
        previewData: null,
        hasAvatar: false,
        hasCover: false,
        onGoToImages: () => undefined,
      }),
    );

    expect(markup).toContain('Saved template: Editorial');
    expect(markup).toContain(
      'aria-label="Editorial. A clean, typographic layout with a focused profile header. Saved. Selected for draft"',
    );
  });
});

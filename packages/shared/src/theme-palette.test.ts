import { describe, expect, it } from 'vitest';
import {
  colorContrastRatio,
  generateProfileThemePalette,
  profileThemeCssVariables,
} from './theme-palette';

describe('generateProfileThemePalette', () => {
  it.each(['#4f46e5', '#059669', '#e11d48', '#d97706', '#ffffff', '#000000'])(
    'produces accessible controls for %s',
    (color) => {
      const palette = generateProfileThemePalette(color);

      expect(colorContrastRatio(palette.buttonText, palette.buttonFill)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(colorContrastRatio(palette.buttonText, palette.primaryHover)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(colorContrastRatio(palette.buttonText, palette.primaryPressed)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(colorContrastRatio(palette.link, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(colorContrastRatio(palette.badgeText, palette.badgeBackground)).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  it('provides component-ready CSS variables and reports lightness adjustment', () => {
    const palette = generateProfileThemePalette('#ffffff');
    const variables = profileThemeCssVariables(palette);

    expect(palette.needsAdjustment).toBe(true);
    expect(variables['--theme-primary']).toBe(palette.primary);
    expect(variables['--theme-dot']).toContain('rgba(');
  });
});

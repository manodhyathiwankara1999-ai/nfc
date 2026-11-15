import { expect, test } from '@playwright/test';
import { PROFILE_TEMPLATE_IDS } from '../../../packages/shared/src/profile-templates';

const templates = ['default', ...PROFILE_TEMPLATE_IDS];
const fixtures = ['full', 'stress', 'minimal'] as const;
const viewports = [
  { width: 320, height: 844, label: '320' },
  { width: 360, height: 844, label: '360' },
  { width: 390, height: 844, label: '390' },
  { width: 430, height: 844, label: '430' },
  { width: 768, height: 1024, label: '768' },
  { width: 820, height: 1180, label: '820' },
  { width: 820, height: 620, label: '820-landscape' },
  { width: 1023, height: 768, label: '1023-landscape' },
  { width: 1024, height: 1024, label: '1024' },
  { width: 1280, height: 900, label: '1280' },
];

test.describe('registered public profile template responsiveness', () => {
  for (const template of templates) {
    for (const fixture of fixtures) {
      test(`${template} template: ${fixture} fixture`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/profile-template-contract?template=${template}&fixture=${fixture}`, {
          waitUntil: 'domcontentloaded',
        });
        await expect(
          page.locator(`[data-template-contract="${template}-${fixture}"]`),
        ).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.evaluate(async () => {
          const images = Array.from(document.images);
          for (const image of images) image.loading = 'eager';
          await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
        });

        for (const viewport of viewports) {
          const { width, height, label } = viewport;
          await page.setViewportSize({ width, height });
          await page.waitForTimeout(100);

          const layout = await page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth;
            const elements = Array.from(document.body.querySelectorAll<HTMLElement>('*'));
            const visible = elements.filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0
              );
            });
            const wideElements = visible
              .map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                  tag: element.tagName.toLowerCase(),
                  className: typeof element.className === 'string' ? element.className : '',
                  left: Math.round(rect.left),
                  right: Math.round(rect.right),
                };
              })
              .filter(({ left, right }) => left < -1 || right > viewportWidth + 1);
            const smallTargets = visible
              .filter((element) => element.matches('a, button'))
              .map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                  label:
                    element.getAttribute('aria-label') ||
                    element.textContent?.trim() ||
                    element.tagName,
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                };
              })
              .filter(({ width: targetWidth, height }) => targetWidth < 44 || height < 44);
            const clippedButtons = visible
              .filter((element) => element.matches('button'))
              .filter(
                (element) =>
                  element.scrollWidth > element.clientWidth + 1 ||
                  element.scrollHeight > element.clientHeight + 1,
              )
              .map(
                (element) =>
                  element.textContent?.trim() ||
                  element.getAttribute('aria-label') ||
                  'unnamed button',
              );
            const distortedImages = Array.from(document.images)
              .filter((image) => image.complete && image.naturalWidth > 0)
              .filter((image) => {
                const style = getComputedStyle(image);
                if (style.objectFit !== 'fill') return false;
                const rect = image.getBoundingClientRect();
                const sourceRatio = image.naturalWidth / image.naturalHeight;
                const renderedRatio = rect.width / rect.height;
                return Math.abs(sourceRatio - renderedRatio) > 0.02;
              })
              .map((image) => image.currentSrc);
            const unloadedImages = Array.from(document.images)
              .filter((image) => !image.complete || image.naturalWidth === 0)
              .map((image) => image.currentSrc || image.src);

            return {
              viewportWidth,
              documentWidth: document.documentElement.scrollWidth,
              wideElements,
              smallTargets,
              clippedButtons,
              distortedImages,
              unloadedImages,
            };
          });

          expect(layout.documentWidth, `document overflows at ${width}px`).toBeLessThanOrEqual(
            layout.viewportWidth,
          );
          expect(layout.wideElements, `elements exceed ${width}px`).toEqual([]);
          expect(layout.clippedButtons, `button text clips at ${width}px`).toEqual([]);
          expect(layout.smallTargets, `interactive targets are under 44px at ${width}px`).toEqual(
            [],
          );
          expect(layout.distortedImages, `images are distorted at ${width}px`).toEqual([]);
          expect(layout.unloadedImages, `images fail to load at ${width}px`).toEqual([]);

          await page.screenshot({
            path: testInfo.outputPath('profile-responsive', `${template}-${fixture}-${label}.png`),
            fullPage: true,
            animations: 'disabled',
          });
        }
      });
    }

    test(`${template} template honors reduced motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/profile-template-contract?template=${template}&fixture=full`);
      await expect(page.locator(`[data-template-contract="${template}-full"]`)).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const activeAnimations = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[class]'))
          .filter((element) => {
            const style = getComputedStyle(element);
            return style.animationName !== 'none' && style.animationDuration !== '0s';
          })
          .map((element) => element.className.toString()),
      );
      expect(activeAnimations).toEqual([]);
    });
  }
});

import { describe, expect, it } from 'vitest';
import {
  getImageUploadErrorMessage,
  ImageFileValidationError,
  validateImageFile,
} from './image-upload-errors';

describe('card image upload feedback', () => {
  it('shows a support message for unconfigured storage without exposing API details', () => {
    const error = {
      message: 'Image storage is not configured. Please contact support.',
      statusCode: 503,
      code: 'STORAGE_NOT_CONFIGURED',
      requestId: 'request-id',
    };

    expect(getImageUploadErrorMessage(error)).toBe(
      "Image upload isn't available right now. Please contact support.",
    );
  });

  it('maps interrupted uploads to a recoverable message', () => {
    expect(getImageUploadErrorMessage(new Error('Image upload failed (403).'))).toBe(
      'The upload was interrupted. Check your connection and try again.',
    );
    expect(
      getImageUploadErrorMessage(new Error('Image upload could not reach Cloudflare R2.')),
    ).toBe('The upload was interrupted. Check your connection and try again.');
  });

  it('validates supported types and the configured size limit with clear messages', () => {
    expect(() => validateImageFile({ type: 'image/gif', size: 10 }, 3 * 1024 * 1024)).toThrow(
      new ImageFileValidationError('Choose a JPG, PNG, or WebP image.'),
    );
    expect(() =>
      validateImageFile({ type: 'image/png', size: 3 * 1024 * 1024 + 1 }, 3 * 1024 * 1024),
    ).toThrow(new ImageFileValidationError('This image is too large. Choose a file up to 3 MB.'));
  });
});

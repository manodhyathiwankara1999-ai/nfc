export class ImageFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageFileValidationError';
  }
}

export function validateImageFile(file: Pick<File, 'type' | 'size'>, maxBytes: number): void {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new ImageFileValidationError('Choose a JPG, PNG, or WebP image.');
  }
  if (file.size > maxBytes) {
    const megabytes = maxBytes / (1024 * 1024);
    throw new ImageFileValidationError(
      `This image is too large. Choose a file up to ${megabytes} MB.`,
    );
  }
}

export function getImageUploadErrorMessage(error: unknown): string {
  if (error instanceof ImageFileValidationError) return error.message;
  const apiError = getApiErrorDetails(error);
  if (apiError) {
    if (apiError.code === 'STORAGE_NOT_CONFIGURED') {
      return "Image upload isn't available right now. Please contact support.";
    }
    if (apiError.statusCode === 429) {
      return 'Too many upload attempts. Wait a moment, then try again.';
    }
    return 'The image could not be uploaded. Please try again.';
  }
  if (
    error instanceof Error &&
    (error.message.includes('could not reach Cloudflare R2') ||
      error.message.startsWith('Image upload failed'))
  ) {
    return 'The upload was interrupted. Check your connection and try again.';
  }
  return 'The image could not be uploaded. Please try again.';
}

function getApiErrorDetails(error: unknown): { code: string; statusCode: number } | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    typeof error.code !== 'string' ||
    !('statusCode' in error) ||
    typeof error.statusCode !== 'number'
  ) {
    return undefined;
  }
  return { code: error.code, statusCode: error.statusCode };
}

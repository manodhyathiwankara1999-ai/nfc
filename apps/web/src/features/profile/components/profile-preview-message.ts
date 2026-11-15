import { ProfilePreviewMessageSchema } from '@nfc/shared';

export function parseProfilePreviewMessage(
  event: { origin: string; source: unknown; data: unknown },
  expectedOrigin: string,
  expectedSource: unknown,
) {
  if (event.origin !== expectedOrigin || event.source !== expectedSource) return null;
  const parsed = ProfilePreviewMessageSchema.safeParse(event.data);
  return parsed.success ? parsed.data : null;
}

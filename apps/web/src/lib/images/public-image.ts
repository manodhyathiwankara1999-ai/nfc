const configuredBase = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;

export function isOptimizablePublicImage(value: string): boolean {
  if (!configuredBase) return false;
  try {
    const image = new URL(value);
    const base = new URL(configuredBase);
    return (
      image.protocol === 'https:' &&
      image.hostname === base.hostname &&
      image.pathname.startsWith(base.pathname.replace(/\/+$/, '') + '/')
    );
  } catch {
    return false;
  }
}

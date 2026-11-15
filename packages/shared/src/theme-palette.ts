export interface ProfileThemePalette {
  primary: string;
  primaryHover: string;
  primaryPressed: string;
  soft: string;
  ring: string;
  icon: string;
  link: string;
  buttonFill: string;
  buttonText: string;
  badgeBackground: string;
  badgeText: string;
  dot: string;
  ink: string;
  needsAdjustment: boolean;
}

export const PROFILE_THEME_PRESETS = [
  { name: 'Indigo', color: '#4f46e5' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Emerald', color: '#059669' },
  { name: 'Rose', color: '#e11d48' },
  { name: 'Amber', color: '#d97706' },
  { name: 'Violet', color: '#7c3aed' },
] as const;

const WHITE = '#ffffff';
const BLACK = '#000000';
const INK = '#111827';
const MINIMUM_CONTRAST = 4.5;

interface HslColor {
  hue: number;
  saturation: number;
  lightness: number;
}

export function generateProfileThemePalette(color: string): ProfileThemePalette {
  const source = /^#[\da-f]{6}$/i.test(color) ? color : '#4f46e5';
  const sourceHsl = hexToHsl(source);
  const primaryHsl = adjustForWhiteContrast(sourceHsl);
  const primary = hslToHex(primaryHsl);
  const buttonText =
    colorContrastRatio(WHITE, primary) >= colorContrastRatio(BLACK, primary) ? WHITE : BLACK;
  const direction = buttonText === WHITE ? -1 : 1;
  const primaryHover = hslToHex(
    accessibleVariant(primaryHsl, buttonText, primaryHsl.lightness + direction * 7),
  );
  const primaryPressed = hslToHex(
    accessibleVariant(primaryHsl, buttonText, primaryHsl.lightness + direction * 13),
  );
  const soft = hslToHex({
    ...sourceHsl,
    saturation: Math.min(sourceHsl.saturation, 55),
    lightness: 96,
  });
  const badgeText = hslToHex(adjustForBackgroundContrast(sourceHsl, soft));

  return {
    primary,
    primaryHover,
    primaryPressed,
    soft,
    ring: primary,
    icon: primary,
    link: primary,
    buttonFill: primary,
    buttonText,
    badgeBackground: soft,
    badgeText,
    dot: hexToRgba(primary, 0.12),
    ink: INK,
    needsAdjustment: primary.toLowerCase() !== source.toLowerCase(),
  };
}

export function profileThemeCssVariables(
  palette: ProfileThemePalette,
): Record<`--theme-${string}`, string> {
  return {
    '--theme-primary': palette.primary,
    '--theme-primary-hover': palette.primaryHover,
    '--theme-primary-pressed': palette.primaryPressed,
    '--theme-soft': palette.soft,
    '--theme-ring': palette.ring,
    '--theme-icon': palette.icon,
    '--theme-link': palette.link,
    '--theme-button-fill': palette.buttonFill,
    '--theme-button-text': palette.buttonText,
    '--theme-badge-background': palette.badgeBackground,
    '--theme-badge-text': palette.badgeText,
    '--theme-dot': palette.dot,
    '--theme-ink': palette.ink,
  };
}

export function colorContrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function adjustForWhiteContrast(color: HslColor): HslColor {
  return adjustForBackgroundContrast(color, WHITE);
}

function adjustForBackgroundContrast(color: HslColor, background: string): HslColor {
  let best = color;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let lightness = 0; lightness <= 100; lightness += 1) {
    const candidate = { ...color, lightness };
    if (colorContrastRatio(hslToHex(candidate), background) < MINIMUM_CONTRAST) continue;
    const distance = Math.abs(lightness - color.lightness);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function accessibleVariant(color: HslColor, text: string, targetLightness: number): HslColor {
  const step = targetLightness < color.lightness ? -1 : 1;
  let best = color;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let lightness = 0; lightness <= 100; lightness += 1) {
    const candidate = { ...color, lightness };
    if (colorContrastRatio(text, hslToHex(candidate)) < MINIMUM_CONTRAST) continue;
    if (Math.sign(lightness - color.lightness) !== step && lightness !== color.lightness) continue;
    const distance = Math.abs(lightness - targetLightness);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function relativeLuminance(hex: string): number {
  const channels = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function hexToHsl(hex: string): HslColor {
  const [red, green, blue] = hexToRgb(hex).map((channel) => channel / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  let saturation = 0;
  const lightness = (maximum + minimum) / 2;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (maximum) {
      case red:
        hue = ((green - blue) / delta) % 6;
        break;
      case green:
        hue = (blue - red) / delta + 2;
        break;
      default:
        hue = (red - green) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return { hue, saturation: saturation * 100, lightness: lightness * 100 };
}

function hslToHex({ hue, saturation, lightness }: HslColor): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = l - chroma / 2;
  const [red, green, blue] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function hexToRgba(hex: string, opacity: number): string {
  const [red, green, blue] = hexToRgb(hex);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

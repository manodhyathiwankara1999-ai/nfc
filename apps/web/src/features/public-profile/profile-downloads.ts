import type { PublicProfile } from '@/features/profile/types/profile';

export function createProfileCsv(profile: PublicProfile, profileUrl: string): string {
  const socialLinks = profile.socialLinks.map((item) => [socialLabel(item.platform), item.url]);
  const rows = [
    ['Full name', profile.fullName],
    ['Job title', profile.jobTitle ?? ''],
    ['Skills', profile.skillsLine ?? ''],
    ['Tagline', profile.tagline ?? ''],
    ['Phone', profile.phone ?? ''],
    ['Email', profile.email ?? ''],
    ['Location', profile.location ?? ''],
    ['Website', profile.website ?? ''],
    ['LinkedIn', profile.linkedinUrl ?? ''],
    ['GitHub', profile.githubUrl ?? ''],
    ...socialLinks,
    ['Profile URL', profileUrl],
  ];
  return rows
    .map(([label, value]) => `${escapeCsvCell(label)},${escapeCsvCell(value)}`)
    .join('\r\n');
}

export function createProfileVCard(profile: PublicProfile, profileUrl: string): string {
  const socialUrls = new Set(
    profile.socialLinks
      .map((item) => item.url)
      .filter((url) => url !== profile.linkedinUrl && url !== profile.githubUrl),
  );
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCardText(profile.fullName)}`,
    profile.jobTitle ? `TITLE:${escapeVCardText(profile.jobTitle)}` : '',
    profile.skillsLine ? `NOTE:${escapeVCardText(profile.skillsLine)}` : '',
    profile.phone ? `TEL;TYPE=CELL:${escapeVCardText(profile.phone)}` : '',
    profile.email ? `EMAIL:${escapeVCardText(profile.email)}` : '',
    profile.location ? `ADR;TYPE=HOME:;;${escapeVCardText(profile.location)};;;;` : '',
    profile.website ? `URL:${escapeVCardText(profile.website)}` : '',
    profile.linkedinUrl ? `URL:${escapeVCardText(profile.linkedinUrl)}` : '',
    profile.githubUrl ? `URL:${escapeVCardText(profile.githubUrl)}` : '',
    ...[...socialUrls].map((url) => `URL:${escapeVCardText(url)}`),
    `URL:${escapeVCardText(profileUrl)}`,
    'END:VCARD',
  ].filter(Boolean);
  return `${lines.join('\r\n')}\r\n`;
}

function socialLabel(platform: string): string {
  const labels: Record<string, string> = {
    WEBSITE: 'Website',
    LINKEDIN: 'LinkedIn',
    GITHUB: 'GitHub',
    INSTAGRAM: 'Instagram',
    FACEBOOK: 'Facebook',
    X: 'X',
    YOUTUBE: 'YouTube',
    TIKTOK: 'TikTok',
  };
  return labels[platform] ?? 'Social link';
}

export function escapeCsvCell(value: string): string {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function escapeVCardText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

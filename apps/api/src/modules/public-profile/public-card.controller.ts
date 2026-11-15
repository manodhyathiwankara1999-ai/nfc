import { Controller, Get, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { ApiEnvironment } from '../../config/env.schema';
import { Public } from '../../common/decorators/public.decorator';
import { PublicRateLimitGuard } from '../../common/guards/public-rate-limit.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CardWorkspaceService } from '../cards/card-workspace.service';
import { CardSlugSchema } from '../cards/cards.schemas';

const DownloadFormatSchema = z.enum(['qr', 'vcard', 'csv']);

@ApiTags('public cards')
@Controller({ path: 'public/cards', version: '1' })
@UseGuards(PublicRateLimitGuard)
export class PublicCardController {
  constructor(
    private readonly cards: CardWorkspaceService,
    private readonly config: ConfigService<ApiEnvironment, true>,
  ) {}

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Resolve active card data or an inactive card name' })
  getBySlug(@Param('slug', new ZodValidationPipe(CardSlugSchema)) slug: string) {
    return this.cards.getPublicCard(slug);
  }

  @Public()
  @Get(':slug/download/:format')
  @ApiOperation({ summary: 'Download an active card QR code, vCard, or CSV' })
  async download(
    @Param('slug', new ZodValidationPipe(CardSlugSchema)) slug: string,
    @Param('format', new ZodValidationPipe(DownloadFormatSchema))
    format: z.infer<typeof DownloadFormatSchema>,
    @Res() response: Response,
  ): Promise<void> {
    const card = await this.cards.getPublicCard(slug);
    if (card.status !== 'active') throw new NotFoundException('Download not found.');

    const fileName = `${slug}.${format === 'qr' ? 'png' : format === 'vcard' ? 'vcf' : 'csv'}`;
    if (format === 'qr') {
      const base = this.config.get('WEB_APP_URL', { infer: true }).replace(/\/+$/, '');
      const profileUrl = `${base}/u/${encodeURIComponent(slug)}`;
      const image = await QRCode.toBuffer(profileUrl, { type: 'png', errorCorrectionLevel: 'M' });
      response.setHeader('Content-Type', 'image/png');
      response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      response.send(image);
      return;
    }

    const { profile } = card;
    if (format === 'vcard') {
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${escapeVCard(profile.fullName)}`,
        ...(profile.jobTitle ? [`TITLE:${escapeVCard(profile.jobTitle)}`] : []),
        ...(profile.contact.email ? [`EMAIL:${escapeVCard(profile.contact.email)}`] : []),
        ...(profile.contact.phone ? [`TEL:${escapeVCard(profile.contact.phone)}`] : []),
        ...(profile.contact.website ? [`URL:${escapeVCard(profile.contact.website)}`] : []),
        'END:VCARD',
      ];
      response.setHeader('Content-Type', 'text/vcard; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      response.send(lines.join('\r\n'));
      return;
    }

    const rows = [
      ['name', 'job_title', 'email', 'phone', 'website', 'office_company'],
      [
        profile.fullName,
        profile.jobTitle ?? '',
        profile.contact.email ?? '',
        profile.contact.phone ?? '',
        profile.contact.website ?? '',
        card.office?.hasOffice ? (card.office.companyName ?? '') : '',
      ],
    ];
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    response.send(rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n'));
  }
}

function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

function escapeCsv(value: string): string {
  const safeValue = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

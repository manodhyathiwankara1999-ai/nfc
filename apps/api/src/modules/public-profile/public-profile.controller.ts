import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PublicRateLimitGuard } from '../../common/guards/public-rate-limit.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CardSlugSchema } from '../cards/cards.schemas';
import { PublicProfileService } from './public-profile.service';

@ApiTags('public profiles')
@Controller({ path: 'public/profiles', version: '1' })
@UseGuards(PublicRateLimitGuard)
export class PublicProfileController {
  constructor(private readonly profiles: PublicProfileService) {}

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Resolve an active card or public profile by opaque slug' })
  getBySlug(@Param('slug', new ZodValidationPipe(CardSlugSchema)) slug: string) {
    return this.profiles.getBySlug(slug);
  }

  @Public()
  @Post(':slug/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Queue a privacy-respecting view event for a public profile' })
  async recordView(
    @Param('slug', new ZodValidationPipe(CardSlugSchema)) slug: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.profiles.recordView(slug, request);
  }
}

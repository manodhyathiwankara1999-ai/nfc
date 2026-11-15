import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { PROFILE_IMAGE_LIMITS, ProfileImageUploadSchema } from '@nfc/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';

const LogoUploadSchema = z
  .object({
    kind: z.literal('LOGO'),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z.number().int().positive().max(PROFILE_IMAGE_LIMITS.COVER),
  })
  .strict();
const PresignSchema = z.union([ProfileImageUploadSchema, LogoUploadSchema]);
const ConfirmSchema = z.object({ assetId: z.string().uuid() }).strict();
const GalleryPatchSchema = z
  .object({
    caption: z.string().max(300).nullable().optional(),
    altText: z.string().max(160).nullable().optional(),
    position: z.number().int().min(0).max(100).optional(),
  })
  .strict();
const SocialInputSchema = z
  .object({
    platform: z.enum([
      'website',
      'linkedin',
      'instagram',
      'x',
      'facebook',
      'youtube',
      'tiktok',
      'github',
    ]),
    label: z.string().trim().min(1).max(80),
    url: z.string().url(),
    position: z.number().int().min(0).max(100).optional(),
  })
  .strict();
const SocialListSchema = z.array(SocialInputSchema).max(20);

@Controller({ version: '1' })
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('uploads/presign')
  presign(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.uploads.presign(user.id, PresignSchema.parse(body));
  }

  @Post('uploads/confirm')
  confirm(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.uploads.confirm(user.id, ConfirmSchema.parse(body).assetId);
  }

  @Delete('uploads/:assetId')
  deleteAsset(@CurrentUser() user: AuthenticatedUser, @Param('assetId') assetId: string) {
    return this.uploads.deleteAsset(user.id, z.string().uuid().parse(assetId));
  }

  @Delete('uploads/current/:kind')
  deleteCurrent(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string) {
    return this.uploads.deleteCurrent(
      user.id,
      z.enum(['AVATAR', 'COVER', 'GALLERY', 'LOGO']).parse(kind),
    );
  }

  @Get('gallery')
  getGallery(@CurrentUser() user: AuthenticatedUser) {
    return this.uploads.getGallery(user.id);
  }

  @Patch('gallery/:imageId')
  updateGallery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('imageId') imageId: string,
    @Body() body: unknown,
  ) {
    return this.uploads.updateGallery(
      user.id,
      z.string().uuid().parse(imageId),
      GalleryPatchSchema.parse(body),
    );
  }

  @Delete('gallery/:imageId')
  deleteGallery(@CurrentUser() user: AuthenticatedUser, @Param('imageId') imageId: string) {
    return this.uploads.deleteGallery(user.id, z.string().uuid().parse(imageId));
  }

  @Get('social-links')
  getSocialLinks(@CurrentUser() user: AuthenticatedUser) {
    return this.uploads.getSocialLinks(user.id);
  }

  @Put('social-links')
  replaceSocialLinks(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.uploads.replaceSocialLinks(user.id, SocialListSchema.parse(body));
  }

  @Post('social-links')
  createSocialLink(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.uploads.createSocialLink(user.id, SocialInputSchema.parse(body));
  }

  @Patch('social-links/:linkId')
  updateSocialLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('linkId') linkId: string,
    @Body() body: unknown,
  ) {
    return this.uploads.updateSocialLink(
      user.id,
      z.string().uuid().parse(linkId),
      SocialInputSchema.partial().parse(body),
    );
  }

  @Delete('social-links/:linkId')
  deleteSocialLink(@CurrentUser() user: AuthenticatedUser, @Param('linkId') linkId: string) {
    return this.uploads.deleteSocialLink(user.id, z.string().uuid().parse(linkId));
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AuthOriginGuard } from '../../common/guards/auth-origin.guard';
import { WriteRateLimitGuard } from '../../common/guards/write-rate-limit.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CardsService } from './cards.service';
import { CardWorkspaceService } from './card-workspace.service';
import { CardUploadsService } from './card-uploads.service';
import {
  CardClaimSchema,
  CardDataSchema,
  CardIdSchema,
  CardOfficePatchSchema,
  CardProfilePatchSchema,
  CardSlugSchema,
  CardUploadConfirmSchema,
  CardUploadPresignSchema,
  ProductCreateSchema,
  ProductReorderSchema,
  ProductUpdateSchema,
} from './cards.schemas';
import type { z } from 'zod';

@ApiTags('cards')
@Controller({ path: 'cards', version: '1' })
export class CardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly workspace: CardWorkspaceService,
    private readonly uploads: CardUploadsService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List cards owned by the authenticated user with their profiles' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.workspace.listMine(user.id);
  }

  @Get(':cardId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an owned card with its profile, office, and products' })
  getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
  ) {
    return this.workspace.getMine(user.id, cardId);
  }

  @Patch(':cardId/profile')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an owned card profile' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
    @Body(new ZodValidationPipe(CardProfilePatchSchema))
    body: z.infer<typeof CardProfilePatchSchema>,
  ) {
    return this.workspace.updateProfile(user.id, cardId, body);
  }

  @Patch(':cardId/details')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the purpose and public URL for an owned card' })
  updateCardDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
    @Body(new ZodValidationPipe(CardDataSchema)) body: z.infer<typeof CardDataSchema>,
  ) {
    return this.workspace.updateCardDetails(user.id, cardId, body);
  }

  @Patch(':cardId/office')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update or toggle office details for an owned card' })
  updateOffice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
    @Body(new ZodValidationPipe(CardOfficePatchSchema))
    body: z.infer<typeof CardOfficePatchSchema>,
  ) {
    return this.workspace.updateOffice(user.id, cardId, body);
  }

  @Post(':cardId/products')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a product to an owned card (maximum five)' })
  addProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
    @Body(new ZodValidationPipe(ProductCreateSchema))
    body: z.infer<typeof ProductCreateSchema>,
  ) {
    return this.workspace.addProduct(user.id, cardId, body);
  }

  @Patch(':cardId/products/reorder')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder all products for an owned card' })
  reorderProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
    @Body(new ZodValidationPipe(ProductReorderSchema))
    productIds: z.infer<typeof ProductReorderSchema>,
  ) {
    return this.workspace.reorderProducts(user.id, cardId, productIds);
  }

  @Patch(':cardId/products/:productId')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit an owned card product' })
  updateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
    @Param('productId', new ZodValidationPipe(CardIdSchema)) productId: string,
    @Body(new ZodValidationPipe(ProductUpdateSchema))
    body: z.infer<typeof ProductUpdateSchema>,
  ) {
    return this.workspace.updateProduct(user.id, cardId, productId, body);
  }

  @Delete(':cardId/products/:productId')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete an owned card product' })
  removeProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
    @Param('productId', new ZodValidationPipe(CardIdSchema)) productId: string,
  ) {
    return this.workspace.removeProduct(user.id, cardId, productId);
  }

  @Post(':cardId/uploads/presign')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a card-owned R2 image upload URL' })
  presignUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
    @Body(new ZodValidationPipe(CardUploadPresignSchema))
    body: z.infer<typeof CardUploadPresignSchema>,
  ) {
    return this.uploads.presign(user.id, cardId, body);
  }

  @Post(':cardId/uploads/confirm')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify an uploaded card image in R2' })
  confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
    @Body(new ZodValidationPipe(CardUploadConfirmSchema))
    body: z.infer<typeof CardUploadConfirmSchema>,
  ) {
    return this.uploads.confirm(user.id, cardId, body);
  }

  @Post(':cardId/activate')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
  ) {
    return this.workspace.activate(user.id, cardId);
  }

  @Post(':cardId/deactivate')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
  ) {
    return this.workspace.deactivate(user.id, cardId);
  }

  @Delete(':cardId')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
  ) {
    return this.workspace.deleteMine(user.id, cardId);
  }

  @Post('claim')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim an inactive card for the authenticated profile' })
  claim(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CardClaimSchema)) body: z.infer<typeof CardClaimSchema>,
  ) {
    return this.cards.claim(user.id, body.claimCode);
  }

  @Patch(':slug/lost')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark an owned card as lost' })
  markLost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug', new ZodValidationPipe(CardSlugSchema)) slug: string,
  ) {
    return this.cards.markLost(user.id, slug);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthOriginGuard } from '../../common/guards/auth-origin.guard';
import { WriteRateLimitGuard } from '../../common/guards/write-rate-limit.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CardWorkspaceService } from '../cards/card-workspace.service';
import {
  AdminAuditSearchSchema,
  AdminCardCreateSchema,
  AdminCardSearchSchema,
  AdminCardUpdateSchema,
  AdminUserSearchSchema,
  CardIdSchema,
} from '../cards/cards.schemas';
import type { z } from 'zod';

@ApiTags('super admin')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly cards: CardWorkspaceService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get super-admin overview totals' })
  overview() {
    return this.cards.adminOverview();
  }

  @Get('cards')
  @ApiOperation({ summary: 'Search and list cards' })
  listCards(
    @Query(new ZodValidationPipe(AdminCardSearchSchema))
    query: z.infer<typeof AdminCardSearchSchema>,
  ) {
    return this.cards.adminListCards(query);
  }

  @Post('cards')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiOperation({ summary: 'Create a card for an existing user by email' })
  createCard(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(AdminCardCreateSchema))
    body: z.infer<typeof AdminCardCreateSchema>,
  ) {
    return this.cards.adminCreateCard(user.id, body);
  }

  @Patch('cards/:cardId')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiOperation({ summary: 'Edit any card' })
  updateCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
    @Body(new ZodValidationPipe(AdminCardUpdateSchema))
    body: z.infer<typeof AdminCardUpdateSchema>,
  ) {
    return this.cards.adminUpdateCard(user.id, cardId, body);
  }

  @Post('cards/:cardId/activate')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiOperation({ summary: 'Activate a card' })
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
  ) {
    return this.cards.adminActivate(user.id, cardId);
  }

  @Post('cards/:cardId/deactivate')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiOperation({ summary: 'Deactivate a card' })
  deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
  ) {
    return this.cards.adminDeactivate(user.id, cardId);
  }

  @Post('cards/:cardId/delete')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiOperation({ summary: 'Soft-delete a card' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
  ) {
    return this.cards.adminDelete(user.id, cardId);
  }

  @Post('cards/:cardId/restore')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiOperation({ summary: 'Restore a soft-deleted card as inactive' })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId', new ZodValidationPipe(CardIdSchema)) cardId: string,
  ) {
    return this.cards.adminRestore(user.id, cardId);
  }

  @Get('users')
  @ApiOperation({ summary: 'Search users and include their card counts' })
  listUsers(
    @Query(new ZodValidationPipe(AdminUserSearchSchema))
    query: z.infer<typeof AdminUserSearchSchema>,
  ) {
    return this.cards.adminListUsers(query);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit log entries, latest first' })
  listAuditLogs(
    @Query(new ZodValidationPipe(AdminAuditSearchSchema))
    query: z.infer<typeof AdminAuditSearchSchema>,
  ) {
    return this.cards.adminListAuditLogs(query);
  }
}

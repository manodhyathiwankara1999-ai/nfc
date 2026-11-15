import { Body, Controller, Get, NotFoundException, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountDetailsUpdateSchema } from '@nfc/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AuthOriginGuard } from '../../common/guards/auth-origin.guard';
import { WriteRateLimitGuard } from '../../common/guards/write-rate-limit.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import type { z } from 'zod';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated user account' })
  me(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
    return { user };
  }

  @Get('me/account')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get account details, separate from card profiles' })
  async account(@CurrentUser() user: AuthenticatedUser) {
    const account = await this.prisma.user.findFirst({
      where: { id: user.id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        accountType: true,
      },
    });
    if (!account) throw new NotFoundException('Account not found.');
    return account;
  }

  @Patch('me/account')
  @UseGuards(AuthOriginGuard, WriteRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update account details without changing card profiles' })
  async updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(AccountDetailsUpdateSchema))
    body: z.infer<typeof AccountDetailsUpdateSchema>,
  ) {
    const result = await this.prisma.user.updateMany({
      where: { id: user.id, deletedAt: null },
      data: { name: body.name, phone: body.phone ?? null },
    });
    if (!result.count) throw new NotFoundException('Account not found.');
    return this.account(user);
  }
}

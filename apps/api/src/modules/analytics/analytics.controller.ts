import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

const SummaryQuerySchema = z
  .object({
    range: z.enum(['7d', '30d', '90d']).default('7d'),
  })
  .strict();

@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.analytics.getSummary(user.id, SummaryQuerySchema.parse(query).range);
  }
}

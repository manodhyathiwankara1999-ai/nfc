import { Controller, Get, HttpStatus, Res, Version } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Public()
  @Version('1')
  @ApiOperation({ summary: 'Check API and PostgreSQL readiness' })
  async check(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.health.check();
    if (readiness.status !== 'ok') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return readiness;
  }
}

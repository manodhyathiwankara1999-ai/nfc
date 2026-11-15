import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import type { ApiEnvironment } from '../../config/env.schema';
import { InMemoryRateLimiter } from '../utils/in-memory-rate-limiter';

@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  constructor(
    private readonly limiter: InMemoryRateLimiter,
    private readonly config: ConfigService<ApiEnvironment, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip || 'unknown';
    const ipHash = createHmac('sha256', this.config.get('IP_HASH_SALT', { infer: true }))
      .update(ip)
      .digest('hex');
    const endpoint = request.method === 'POST' ? 'view' : 'resolve';
    const count = this.limiter.increment(`public:rate:${endpoint}:${ipHash}`, 60_000);
    if (count > 60) {
      throw new HttpException(
        'Too many public profile requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

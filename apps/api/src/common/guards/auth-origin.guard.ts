import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ApiEnvironment } from '../../config/env.schema';

@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<ApiEnvironment, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.header('origin');
    const allowedOrigins = this.config.get('CORS_ORIGINS', { infer: true });
    if (!origin || !allowedOrigins.includes(origin)) {
      throw new ForbiddenException('The request origin is not allowed.');
    }
    return true;
  }
}

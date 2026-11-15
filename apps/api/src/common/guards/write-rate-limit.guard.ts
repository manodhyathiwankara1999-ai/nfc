import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { InMemoryRateLimiter } from '../utils/in-memory-rate-limiter';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class WriteRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: InMemoryRateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actorId = request.user?.id;
    if (!actorId) {
      throw new HttpException('Authentication is required.', HttpStatus.UNAUTHORIZED);
    }

    const count = this.limiter.increment(`writes:${actorId}`, 60_000);
    if (count > 60) {
      throw new HttpException(
        'Too many write requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

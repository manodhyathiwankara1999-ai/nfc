import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { InMemoryRateLimiter } from './utils/in-memory-rate-limiter';
import { WebRevalidationService } from './utils/web-revalidation.service';

@Global()
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    InMemoryRateLimiter,
    WebRevalidationService,
  ],
  exports: [InMemoryRateLimiter, WebRevalidationService],
})
export class CommonModule {}

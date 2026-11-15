import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { ApiConfigModule } from './config/config.module';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { CardsModule } from './modules/cards/cards.module';
import { PublicProfileModule } from './modules/public-profile/public-profile.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { AdminModule } from './modules/admin/admin.module';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ApiConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (_request, response) => {
          const requestId = randomUUID();
          response.setHeader('x-request-id', requestId);
          return requestId;
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers.x-forwarded-for',
            'req.headers.cf-connecting-ip',
            'req.remoteAddress',
            'req.remotePort',
            'req.ip',
            'req.url',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    CommonModule,
    PrismaModule,
    HealthModule,
    UsersModule,
    ProfilesModule,
    CardsModule,
    PublicProfileModule,
    AnalyticsModule,
    UploadsModule,
    OrdersModule,
    CompaniesModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

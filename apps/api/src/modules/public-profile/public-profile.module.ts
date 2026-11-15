import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PublicRateLimitGuard } from '../../common/guards/public-rate-limit.guard';
import { CardsModule } from '../cards/cards.module';
import { PublicCardController } from './public-card.controller';
import { PublicProfileController } from './public-profile.controller';
import { PublicProfileService } from './public-profile.service';

@Module({
  imports: [AnalyticsModule, CardsModule],
  controllers: [PublicProfileController, PublicCardController],
  providers: [PublicProfileService, PublicRateLimitGuard],
})
export class PublicProfileModule {}

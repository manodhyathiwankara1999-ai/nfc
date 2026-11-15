import { Module } from '@nestjs/common';
import { AuthOriginGuard } from '../../common/guards/auth-origin.guard';
import { WriteRateLimitGuard } from '../../common/guards/write-rate-limit.guard';
import { CardsModule } from '../cards/cards.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [CardsModule],
  controllers: [AdminController],
  providers: [AuthOriginGuard, WriteRateLimitGuard],
})
export class AdminModule {}
